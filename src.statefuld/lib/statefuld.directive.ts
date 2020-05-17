import {Directive, NgModule, OnInit} from '@angular/core';

// WIP, work in progress


@Directive({
  selector: '[appStatefuld]'
})
// Statefuld service as directive TODO [not yet implemented]
export class StatefuldDirective implements OnInit {

  constructor(
  //  private renderer: Renderer2,
  //  private el: ElementRef
  )
  {}

  ngOnInit() {
    // this.renderer.setStyle( this.el.nativeElement, 'XOX', 'XOX');
    // this.renderer.setProperty( this.el.nativeElement, 'value', 'XOX');
  }
}


@NgModule({
  declarations: [StatefuldDirective],
  exports: [StatefuldDirective]
})
// Statefuld directive is not yet implemented
export class StatefuldDirectiveModule {}