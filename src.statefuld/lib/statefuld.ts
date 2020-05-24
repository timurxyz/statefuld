import {OnInit, OnDestroy, Input} from '@angular/core';
import {statefuld, FnGetSourceInstanceByKey} from './statefuld.service';

/**
 * Statefuld core: decorator and base class versions
 */

// re-export
// @ts-ignore
export {statefuld, FnGetSourceInstanceByKey} from './statefuld.service';

// See README for explanations
export interface StatefuldConfig {
  dProps: [string];
  keyProp?: string;
  forceClass?: string;
  fnGetSourceInstanceByKey?: FnGetSourceInstanceByKey;
}

export interface IStatefuld {
  statefuldKey: string;
  statefuldStash(): boolean;
  statefuldReassign(): boolean;
  statefuldSwitch( branch?: string): boolean;
}

enum Whoami { decorator, baseclass }

/**
 * Statefuld class decorator
 * Saves the specified named properties onDestroy and restores those onInit
 * @param config - a) array of property names to store; b) see StatefuldConfig
 */
export function Statefuld(config: StatefuldConfig|Array<string>) {

  return <SubjectClass extends OverriderCtor>(SubjectClassCtor: SubjectClass) => MixinStatefuld(SubjectClassCtor, config, Whoami.decorator);
  // see the return type defined in the return above
}


/** StatefuldClass -- the Statefuld decorator alternative
 * Use it in extend as a base class though you can specify the configuration as an argument since its a function.
 * Saves the specified (see config) named properties onDestroy and restores those onInit.
 * @param config - a) array of property names to store; b) see StatefuldConfig
 */
export function StatefuldClass<SubjectClass extends OverriderCtor>(config?: StatefuldConfig|Array<string>) {

  return MixinStatefuld( class{}, config, Whoami.baseclass);
}


// tslint:disable-next-line:no-empty-interface
interface ISubjectClassHasOnInit extends OnInit {}
// tslint:disable-next-line:no-empty-interface
interface ISubjectClassHasOnDestroy extends OnDestroy {}
interface ISubjectClassHasBoth extends OnInit, OnDestroy {}
type OverriderCtor<T = {}|ISubjectClassHasOnInit|ISubjectClassHasOnDestroy|ISubjectClassHasBoth> = new(...args: any[]) => T;


// The embedded interface to the statefuld service, a mixin function, consumed by the decorator and the base class
function MixinStatefuld<SubjectClass extends OverriderCtor>(
    SubjectClassCtor: SubjectClass, // superclass if accessed via the decorator, pseudo-class if accessed via the base class function
    config: StatefuldConfig|Array<string>,
    whoami: Whoami
  ) {

  const _dProps = config instanceof Array ? config : config.dProps;
  const _keyProp = !(config instanceof Array) && config.keyProp !== undefined ? config.keyProp : 'statefuldKey';
  const _fnGetSourceInstanceByKey = !(config instanceof Array) && config.fnGetSourceInstanceByKey !== undefined ? config.fnGetSourceInstanceByKey : undefined;

  // @ts-ignore
  return class extends SubjectClassCtor implements IStatefuld {

    constructor(
      ...args: any[]  // base class will not pass arguments
    ) {
      super(...args); // will have no effect in case of base class
      statefuld.registerClass<SubjectClass>( this.constructor.name, _dProps, _keyProp, _fnGetSourceInstanceByKey);
    }

    // @Input('statefuld-key')
    // statefuldKey: string;

    // a watchdog to warn if the Init/Destroy order doesn't work as expected, very unlikely
    __chkNgLifecycle_iSodZqRKwO = 0; // TODO: make it private when packaging will allow

    // see statefuld.stash in the service
    statefuldStash(): boolean {
      return statefuld.stash( this as unknown as SubjectClass);
    }

    // see statefuld.reassign in the service
    statefuldReassign(): boolean {
      return statefuld.reassign( this as unknown as SubjectClass);
    }

    // see statefuld.switch in the service
    statefuldSwitch( branch?: string): boolean {
      return statefuld.switch( branch);
    }

    ngOnInit(): void {

      if (this.__chkNgLifecycle_iSodZqRKwO !== 0) {
        console.warn('statefuld: unexpected order of Init/Destroy execution, class:', SubjectClassCtor.name);
      }

      this.statefuldReassign();

      if (super.ngOnInit !== undefined) { // works in case of decorator (in case of base class 'super' has no actual meaning)
        super.ngOnInit();
      }
    }

    ngOnDestroy(): void {

      this.__chkNgLifecycle_iSodZqRKwO = 1;

      this.statefuldStash();

      if (super.ngOnDestroy !== undefined) {  // works in case of decorator (in case of base class 'super' has no actual meaning)
        super.ngOnDestroy();
      }
    }

  }; // class
}
