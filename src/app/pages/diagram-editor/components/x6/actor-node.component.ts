import { Component, Input, AfterViewInit, Injector } from '@angular/core';
import { register, Content } from '@antv/x6-angular-shape';

@Component({
  selector: 'app-actor-node',
  template: `
    <div class="actor-node">
      <div class="actor-node-head"></div>
      <div class="actor-node-body"></div>
      <div class="actor-node-label">{{ data?.label || 'Actor' }}</div>
    </div>
  `,
  styles: [
    `
      .actor-node {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .actor-node-head {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background-color: #ffffff;
        border: 2px solid #5f95ff;
        margin-bottom: 5px;
      }
      .actor-node-body {
        width: 40px;
        height: 40px;
        background-color: #ffffff;
        border: 2px solid #5f95ff;
        border-radius: 10px 10px 0 0;
        margin-bottom: 5px;
      }
      .actor-node-label {
        font-size: 12px;
        color: #333333;
        text-align: center;
      }
    `,
  ],
  standalone: false,
})
export class ActorNodeComponent implements AfterViewInit {
  @Input() data: any;

  ngAfterViewInit() {
    register({
      shape: 'actor-node',
      width: 80,
      height: 100,
      injector: this.injector,
      content: this as unknown as Content,
    });
  }

  constructor(private injector: Injector) {}
}
