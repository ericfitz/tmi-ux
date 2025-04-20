import { Component, Input, AfterViewInit, Injector } from '@angular/core';
import { register, Content } from '@antv/x6-angular-shape';

@Component({
  selector: 'app-process-node',
  template: `
    <div class="process-node">
      <div class="process-node-label">{{ data?.label || 'Process' }}</div>
    </div>
  `,
  styles: [
    `
      .process-node {
        width: 100%;
        height: 100%;
        border: 2px solid #5f95ff;
        border-radius: 6px;
        background-color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .process-node-label {
        font-size: 14px;
        color: #333333;
        text-align: center;
        padding: 0 5px;
      }
    `,
  ],
  standalone: false,
})
export class ProcessNodeComponent implements AfterViewInit {
  @Input() data: any;

  constructor(private injector: Injector) {}

  ngAfterViewInit() {
    register({
      shape: 'process-node',
      width: 120,
      height: 60,
      injector: this.injector,
      content: this as unknown as Content,
    });
  }
}
