import {Injectable} from '@angular/core';

// Provides the statefuld singleton storage with its static methods.
// The storage/cache structure is as follows:
// 0. Store / 1. Classes / 2. Branches / 3. Instances / 4. Properties
// all in maps. The id of a map you find in the key of its node in the parent map.
// 4. (Set of) Properties, which instantiate an Instance of a Class:
type InstanceProps = Map< string, any>; // [prop name/key, prop value], persisted props of an instance
// 3. Instances of a Class which former belong to a Branch:
type SetOfInstances = Map< string, InstanceProps>; // [id, props map], map of instances (sets of their props)
// 2. Branches of Instances, aka spaces or contexts (like a project in Google console)
type Branches = Map< string, SetOfInstances>; // [id, instances], separate groups of instances, separated in the app's namespace
export type FnGetSourceInstanceByKey = (key: string) => any;
// 1. Classes:
class ClassNode {
  constructor(
    public dProps: Set<string>,  // names of the values to store
    public branchNodes: Branches, // instances grouped by branches (spaces, contexts)
    private getCurrentBranch: () => string, // the running branch/space specific to the class (may differ from the main current branch)
    public keyProp?: string,  // index key in the class, defaults to 'id'
    public fnGetSourceInstanceByKey?: FnGetSourceInstanceByKey  // callback to access an instance of the class by the reference to a keyProp value
  ){
    this.keyProp = keyProp !== undefined ? keyProp : 'id';
    // this.branchNodes.set(getCurrentBranch(), new Map< string, InstanceProps>() as SetOfInstances); created by store anyways
    // should be guaranteed that either currentBranch or * node is present
    // console.log('statefuld: service class constructor called');
  }
  public getInstance = (id: string) => this.branchNodes.get(this.getCurrentBranch()).get(id) as InstanceProps;  // undefined if doesn't exist
  public setInstance = (id: string, map: InstanceProps) => this.branchNodes.get(this.getCurrentBranch()).set(id, map);
}
// 0. The storage itself:
type Store = Map< string, ClassNode>; // set (map) of classes, [id, node]

@Injectable({
  providedIn: 'root',
})
/**
 * Pseudo class which is the actual singleton instance of the statefuld registry
 */ 
// tslint:disable-next-line:class-name
export class statefuld {

  private static storage: Store = new Map<string, ClassNode>();  // classes / branches / instances
  private static currentBranch = '*';

  constructor() {}

  /**
   * Creates a storage node for a class, which node then be populated with the instances of it (separated by branches).
   * Usage eg:
   * statefuld.registerClass<Hero>( 'Hero', ['name', 'sex', 'deeds', 'bio', 'homeCity'], undefined,
   *                                (key) => this.heroFormGroup.value);
   * @param subjectClass - can take the literal name of the class or determines it from the provided object of a known typescript type
   * @param dProps - list properties to store/stash (by default will store nothing)
   * @param keyProp - name the property which makes the instance unique (optional, default is 'id')
   * @param fnGetSourceInstanceByKey - optional: provide a callback to access the source instance to store/stash (takes keyProp value, returns the object)
   */
  static registerClass<T>( subjectClass: string|T, dProps: Array<string> | Set<string>, keyProp?: string,
                           fnGetSourceInstanceByKey?: (key: string) => Partial<T>): boolean {

    const className = typeof subjectClass !== 'string' ? (subjectClass as T).constructor.name : (subjectClass as string);
    if (this.storage.has(className)) {
      return false;
    }
    if (dProps === undefined || dProps[0] === undefined) {
      console.warn('statefuld: attempt to register a class with empty props specification,', className);
      return false;
    }
    const classNode = new ClassNode(
      dProps instanceof Array ? new Set(dProps as string[]) : dProps as Set<string>,
      new Map< string, SetOfInstances>() as Branches,
      () => this.currentBranch,
      keyProp, fnGetSourceInstanceByKey);
    this.storage.set(className, classNode);
    // console.log('statefuld: class registered:', className, this.storage.get(className));
    return true;
  }

  /** Switches the branch, the subject scope/context/space/project of the whole UI.
   * The default branch is '*', meant to cover everything (not implemented separately).
   * @param branch - name of the branch, like the project or workspace which a use can switch
   */
  static switch( branch?: string): boolean {

    if (branch === undefined) {
      if ( this.currentBranch === '*') {
        return true;
      } else {
        return this.switch('*');  // a keyword works as fn name, hm
      }
    }
    if (branch === this.currentBranch) {
      return true;
    }
    this.currentBranch = branch;
    // console.log('statefuld: new branch', branch);
    return true;
  }

  /**
   * Assigns values stored/stashed under a given class node with the given instance id (via target.*keyProp) to the target object.
   * Typical usage:
   * a) statefuld.reassign( this as unknown as T);
   * b) statefuld.reassign<Hero>( hero, 'Hero');
   * @param targetObj - the instance which properties to load with the stored values
   * @param forcedClassName - may the class not be discovered from the typescript context then define it (optional)
   * @param forcedId - the id of the instance, may the keyProp property not be possible to obtain
   */
  static reassign<T>(targetObj: T, forcedClassName?: string, forcedId?: string): boolean {

    const className = forcedClassName === undefined ? targetObj.constructor.name : forcedClassName;
    if (className === undefined || !this.storage.has(className)) {
      console.log( 'statefuld: attempt to assign values for an object of a class not yet registered:', className);
      return false;
    }
    const classNode = this.storage.get(className);
    const id = forcedId === undefined ? targetObj[classNode.keyProp] : forcedId;
    if (id === undefined) {
      console.warn( 'statefuld: attempt to assign a value set w/o id defined. Class/keyProp:', className, '/', classNode.keyProp);
      return false;
    }
    if (! classNode.branchNodes.has(this.currentBranch)) {
      console.log( 'statefuld: attempt to assign values from a not-yet-stored instance due to missing branch referenced:', className, '/', classNode.keyProp, '/', this.currentBranch);
      return false;
    }
    if (classNode.getInstance(id) === undefined) {
      console.log( 'statefuld: attempt to assign values from a not-yet-stored instance, this id has not yet been stored:', className, '/', classNode.keyProp, '/', this.currentBranch);
      return false;
    }
    const instance = classNode.getInstance(id);
    classNode.dProps.forEach(prop => instance.has(prop) && ( targetObj[prop] = instance.get(prop)) );

    // console.log('statefuld: assigned', className, id, targetObj, instance);
    return true;
  }

  /**
   * Stores properties (see: registerClass/dProps) of the payload (object) as the current dirt of an instance of a class.
   * The actual storage instance is matched by the key property in the payload (see: registerClass/keyProp)) or the forcedId argument.
   * Typical usage:
   * a) statefuld.stash( this as unknown as T);
   * b) statefuld.stash<Hero>( hero, 'Hero');
   * @param payloadObj - the instance which properties will be persisted between Init/Destroy cycles
   * @param forcedClassName - if the type (class name) of the object can not be obtained by typescript then provide it in the forcedClassName
   * @param forcedId - the id of the instance, may the keyProp property not be possible to obtain
   */
  static stash<T>(payloadObj: T| Partial<T>, forcedClassName?: string, forcedId?: string): boolean {

    const className = forcedClassName === undefined ? payloadObj.constructor.name : forcedClassName; // TODO
    if ( className === undefined || !this.storage.has(className)) {
      console.log( 'statefuld: attempt to store values to a class not yet registered:', className);
      return false;
    }
    const classNode = this.storage.get(className);
    const id = forcedId === undefined ? payloadObj[classNode.keyProp] : forcedId;

    if (id === undefined) {
      console.warn( 'statefuld: attempt to store a value set w/o id defined. Class/keyProp:', className, '/', classNode.keyProp);
      return false;
    }
    if (! classNode.branchNodes.has(this.currentBranch)) {
      classNode.branchNodes.set(this.currentBranch, new Map<string, InstanceProps>() as SetOfInstances);
      // console.log( 'statefuld: new branch node created for a class and its instance:', this.currentBranch, '/', className, '/', id);
    }
    if (classNode.getInstance(id) === undefined) {
      classNode.setInstance(id, new Map< string, any>() as InstanceProps);
    }
    const instance = classNode.getInstance(id);
    classNode.dProps.forEach(prop => payloadObj[prop] !== undefined && ( instance.set(prop, payloadObj[prop])) );

    // console.log('statefuld: stored an instance (className, id, payload):', className, id, payloadObj);
    return true;
  }

  /**
   * A wrapper to the stash method which accesses the source object:
   * - via callback (see the fnGetSourceInstanceByKey arg of the registerClass method)
   * - from the explicitly provided forcedPayload object.
   * @param className - see forcedClassName param of stash
   * @param id - identifies the storage instance (also being the argument of the callback), see forcedId of stash
   * @param forcedPayload - see payloadObj param of stash
   */
  static stashByKey<T>(className: string, id: string, forcedPayload?: Partial<T>) {

    if (! this.storage.has(className)) {
      console.log( 'statefuld/stash/byKey: attempt to store values for a class not yet registered:', className);
      return false;
    }
    const classNode = this.storage.get(className);
    const payload = forcedPayload === undefined ? classNode.fnGetSourceInstanceByKey(id) : forcedPayload;
    this.stash( payload, className, id);
  }

}

