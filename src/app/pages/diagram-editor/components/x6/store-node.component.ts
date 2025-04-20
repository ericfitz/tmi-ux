import { Component, Input, AfterViewInit, Injector } from '@angular/core';
import { register, Content } from '@antv/x6-angular-shape';

@Component({
  selector: 'app-store-node',
  template: `
    <div class="store-node">
      <div class="store-node-label">{{ data?.label || 'Store' }}</div>
    </div>
  `,
  styles: [
    `
      .store-node {
        width: 100%;
        height: 100%;
        background-color: #ffffff;
        border: 2px solid #5f95ff;
        border-radius: 50% / 20%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }
      .store-node::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 50% / 20%;
        border-top: 2px solid #5f95ff;
        border-bottom: 2px solid #5f95ff;
        box-sizing: border-box;
      }
      .store-node-label {
        font-size: 14px;
        color: #333333;
        text-align: center;
        padding: 0 5px;
        position: relative;
        z-index: 1;
      }
    `,
  ],
  standalone: false,
})
export class StoreNodeComponent implements AfterViewInit {
  @Input() data: any;

  constructor(private injector: Injector) {}

  ngAfterViewInit() {
    register({
      shape: 'store-node',
      width: 120,
      height: 60,
      injector: this.injector,
      content: this as unknown as Content,
    });
  }
}
