# statefuld (Stateful dirt daemon)

`statefuld` (stateful dirt daemon, stateful-dee) is a lightweight Angular persistence service 🛄  to make values of data properties of components/classes survive Init/Destroy circles throughout a user session.  

[![GitHub version](https://badge.fury.io/gh/timurxyz%2Fstatefuld.svg)](https://badge.fury.io/gh/timurxyz%2Fstatefuld)
[![npm version](https://badge.fury.io/js/statefuld.svg)](https://badge.fury.io/js/statefuld)

Typically, the orphan data properties in need of such a persistence are the UI input fields ('dirt') and also states of widgets.  
Which all from the user's perspective are expected to persist as she filled those fields in or left the controls (opened or closed) while Angular will wash these settings out as the UI moves around.
(And your code doesn't care as such unsaved values are not part of your precious - business - logic.)
Also usable in other use cases where the notion of dirt does not apply.

Like:
```ts 
@Statefuld(['searchBoxDirt', 'isAdvanced'])
@Component({
  selector: 'hero-search', ...
  providers: [HeroSearchService]
})
export class HeroSearchComponent implements OnInit { ...
  @Input() searchBoxDirt: string; // this user input we would like to persist
  isAdvanced: boolean;
  private id: string; // we may have several hero serch boxes in the app
  ngOnInit(): void { ...
```

### How it works

`Statefuld` class decorator (or the `StatefuldClass` as its alternative) 
binds the `statefuld` ephemeral storage to a component (any kind of class actually).
As a parameter of the decorator you define the names of the data properties of the component the values of which to retain during the user session:

`@Statefuld(['name', 'sex', 'deeds', 'bio', 'homeCity'])`

Done. 🎏  Now the instances of your HeroCard component will retain the dirt a user enters into the above fields on any particular card. The decorator will inject its onInit and onDestroy functionality, register your HeroCardComponent class into storage (when the component is constructed), store the content of the fields of its instances (on destroy), and reassign (on init) the corresponding dirt to a hero's card as the user returns to a given card (say the user scrolls the list of heroes and updates many such cards before submitting all card changes to the server).

In a more complicated case the configuration of the decorator can hold a different than 'id' (index) field which distinguishes instances of the component or it also can define a callback function to locate the right instance:

```ts
@Statefuld({
  dProps: ['name', 'sex', 'deeds', 'bio', 'homeCity'],  
  keyProp: 'UID',  
  fnGetSourceInstanceByKey: (key) => this.herocardFormGroup.value  
})
export class HeroCardComponent implements OnInit, AfterViewInit {
```

May decorator not be the appropriate instrument then you can use the base class instead. Its constructor function (`StatefuldClass`) accepts the same configuration as the decorator:
```ts
export class HeroCardComponent extends StatefuldClass(['name', 'sex', 'deeds', 'bio', 'homeCity']) implements OnInit, OnDestroy, AfterViewInit ...
```
(Note: For the class to perform the same automatic reassign and stash functionality you need to call `super` for Init and Destroy manually though (the decorator does/injects it for you).)

#### Choosing between decorator and baseclass variants, or raw calls

To make use of statefuld service you have three alternatives:

##### 1. Manually call the service functions

* Actually if you need control over when to save and reload the dirt / values of the data properties of your class/component then you call the service API directly. See the API below.
* The decorator and the base class will only provide you shorter, less error prone function calls. Like `statefuldReassign()` vs `statefuld.reassign<HeroCardComponent>( this, 'HeroCardComponent')`.
* The direct service API calls provide you more exotic options.
* You have to manage the `registerClass` call yourself if you don't use decorator or base class!
* The API member `stashByKey` is only available directly. 

##### 2. Decorator

* If your only goal is to store/restore the dirt / values on Init/Destroy automatically, then the only thing you do is you assign the decorator to your component. No more efforts needed.
* You are expected to use the decorator way by default.
* This implements/calls `registerClass` properly for you.
* It stores/restores (stash/reassign) the specified fields in an unattended/automatic manner.
* You still can do manual calls via the member methods or via the service API.
* You need to declare the helper interface manually though if you choose to call the member methods version of API like `statefuldReassign()` (as the Typescript decorators does not assign new methods explicitly as per now).

To assign the interface to your component you need to do the following harmless trick (see the interface assignment line):
```ts
// tslint:disable-next-line:no-empty-interface
export interface HeroCardComponent extends IStatefuld {}
@Statefuld({
...
})
export class HeroCardComponent implements OnInit, AfterViewInit { ...
```
That is assign the IStatefuld interface to your class component first. And yes, suppress the complaints of the linter.

##### 3. Base class

* Many of what the points in the Decorator subsection above apply here. Except:
* The order of calling the Init and Destroy methods will differ between the decorator and the base class cases. The decorator generated ngOnInit will fire before your ngOnInit runs.
* You don't need to bother with the IStatefuld interface, this comes by inheritance.
* You do need to call the super.ngOnInit() and super.ngOnDestroy to activate the implicit reassign and stash calls. See below.
* In case you control storing/restoring manually then this is your way. Forget the below.

```ts
  ngOnInit() {  // if unattended restore (re-assignment) of the dirt is needed 
  super.ngOnInit();
  ...
  }
  OnDestroy() {     // if unattended saving (stashing) of the dirt is needed 
  super.OnDestroy();
  ...
  }  
}
```

#### Manipulating the storage (methods)

`statefuld` service class is a singleton instance of the storage itself with static methods only and its embedded storage (dirt cache) being its static member. Thus you can manipulate the storage by directly calling its API:  
* registerClass() -- Creates a storage node for a class, which node then be populated with the instances of it (separated by branches). The decorator or the base class does this registration implicitly for you (in constructors).  
* stash(), statefuldStash() -- Saves the actual values of an instance (with the decorator or the base class automatically onDestroy). Aka shelve.  
* reassign(), statefuldReassign() -- Assigns the stored values to an instance (with the decorator and base class automatically onInit). Aka unshelve.  
* switch(), statefuldSwitch() -- Switches between branches. Regarding *branches* see the storage descriptions below (this you do manually).  

Thus the full functionality of the service is accessible w/o employing the decorator or the base class. You can:
* Register your class with statefuld in your constructor;  
* Store the updated values of the data properties as they get updated;  
* Restore the cached values when your component gets instantiated again and the UI fields representing those are ready to sense the initial change (typically that is the case with observables).  

Example:
```ts
...
statefuld.registerClass<HeroCard>( 'HeroCard', ['name', 'sex', 'deeds', 'bio', 'homeCity'],
  undefined, (key) => this.herocardFormGroup.value);
...
this.formGroupChangeSubscribeDirt = this.herocardFormGroup.valueChanges.pipe(debounceTime(1000))
  .subscribe( dirt =>
    statefuld.stashByKey<HeroCard>('HeroCard', this.heroCard.getValue().id, dirt)
  );
...
this.getHeroCardsService.fetch(queryParams).pipe(...).subscribe(hc => {
  statefuld.reassign<HeroCard>( hc, 'HeroCard');
  this.heroCard.next(hc);
});

```

### The storage and the storage rules

This statefuld ephemeral storage understands the world structured as:  
* Branches  
* Classes  
* Instances  
* Properties   
  
where:

* *Branch* is a group of instances on which the app is operating singularly (while other branches are inactive).
* Using branches is optional, the default context is `*`.
* A class is to be registered explicitly prior to storing its instances (done implicitly by the decorator and the base class).
* While registering you have to define which property of a class is the unique/instantiating index (`keyProp`), see also `statefuldKey` 👇🏻.
* The instance of the class should be indexed by the additional `statefuldKey` property may the class itself not handle a unique property but you can define it as a property of the selector (see the example in the API subsection below).
* While registering you have to name which data properties to make persistent.

In fact technically the storage implements a different hierarchy: classes / branches / instances.  
As a consequence registration of classes works independently of switching branches. 

The factual storage/cache structure is then as follows:  
0. The Store itself -- the whole cache represented by the statefuld singleton   
    * Map< string, ClassNode> -- set (map) of classes, [id, node]  
1. Classes  
    * dProps: Set<string> -- names of the values to store  
    * branchNodes -- instances grouped by branches (spaces, contexts)   
    * keyProp -- index key in the class, defaults to 'id'  
2. Branches:  
    * Branches of Instances, aka spaces or contexts (like a project in Google console)  
    * Map< string, SetOfInstances> -- [id, instances], separate groups of instances, separated in the app's namespace  
3. Instances  
    * Instances of a Class which former belong to a Branch  
    * Map< string, InstanceProps> -- [id, props map], map of instances (sets of their props)  
4. Properties  
    * (Set of) Properties, which instantiate an Instance of a Class  
    * Map< string, any> -- [prop name/key, prop value], persisted props of an instance  

### API

#### registerClass
```ts
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
                           fnGetSourceInstanceByKey?: (key: string) => Partial<T>): boolean
```

#### stash
```ts
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
  static stash<T>(payloadObj: T| Partial<T>, forcedClassName?: string, forcedId?: string): boolean
```

#### reassign
```ts
  /**
   * Assigns values stored/stashed under a given class node with the given instance id (via target.*keyProp) to the target object.
   * Typical usage:
   * a) statefuld.reassign( this as unknown as T);
   * b) statefuld.reassign<Hero>( hero, 'Hero');
   * @param targetObj - the instance which properties to load with the stored values
   * @param forcedClassName - may the class not be discovered from the typescript context then define it (optional)
   * @param forcedId - the id of the instance, may the keyProp property not be possible to obtain
   */
  static reassign<T>(targetObj: T, forcedClassName?: string, forcedId?: string): boolean
```

#### switch
```ts
  /** Switches the branch, the subject scope/context/space/project of the whole UI.
   * The default branch is '*', meant to cover everything (not implemented separately).
   * @param branch - name of the branch, like the project or workspace which a use can switch
   */
  static switch( branch?: string): boolean
```

#### statefuldKey

In case the instances are uniquely defined in templates, then use the `statefuldKey` property. By example:

```ts
// Component class declares:
  @Input('statefuld-key')
  public statefuldKey: string;

// Then different instances distinguished by different HTML codes define their index 
  <app-filter-field
    #filterField
    (filterTextChanged)="filterFieldChanged()"
    [statefuld-key]="'addHerosFilterForNonamericanheros'">
  </app-filter-field>
```

### Importing

If the automatism provided with the decorator or the base class is sufficient and you go deno way then (almost, but the .ts extension):
```ts
import {Statefuld, IStatefuld} from 'statefuld/statefuld';
// or
import {StatefuldClass} from 'statefuld/statefuld';

// or may you need raw calls in addition then:
import {Statefuld, statefuld, IStatefuld} from 'statefuld/statefuld';
```

May you go the manual control way only:
```ts
import {statefuld} from 'statefuld/statefuld.service';
```

Or the all-in classic Node way (statefuld being the module):
```ts
import {Statefuld, IStatefuld, statefuld} from 'statefuld';
```

### Roadmap

* Implementing the Directive variant

### References

* https://github.com/BioPhoton/rxjs-state
* https://www.typescriptlang.org/docs/handbook/decorators.html
* https://www.logicbig.com/tutorials/misc/typescript/property-decorators.html
* https://github.com/microsoft/TypeScript/issues/37142
* https://stackoverflow.com/questions/34411546/how-to-properly-wrap-constructors-with-decorators-in-typescript
* https://studiolacosanostra.github.io/2019/02/18/Angular-Custom-class-decorator-Force-OnInit-OnDestroy-implementation/

### Credits 

* This thing was developed for a project by ProofIT.hu, a deep test automation company
* Photo by Alexander Schimmeck on Unsplash

### Changelog


