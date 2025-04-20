import { Component, Input, AfterViewInit, Injector } from '@angular/core';
import { register, Content } from '@antv/x6-angular-shape';

@Component({
  selector: 'app-store-node',
  template: `
    <div class="store-node">
      <div class="store-node-top"></div>
      <div class="store-node-body">
        <div class="store-node-label">{{ data?.label || 'Store' }}</div>
      </div>
      <div class="store-node-bottom"></div>
    </div>
  `,
  styles: [
    `
      .store-node {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .store-node-top {
        height: 10px;
        background-color: #ffffff;
        border: 2px solid #5f95ff;
        border-bottom: none;
        border-radius: 6px 6px 0 0;
      }
      .store-node-body {
        flex: 1;
        background-color: #ffffff;
        border-left: 2px solid #5f95ff;
        border-right: 2px solid #5f95ff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .store-node-bottom {
        height: 10px;
        background-color: #ffffff;
        border: 2px solid #5f95ff;
        border-top: none;
        border-radius: 0 0 6px 6px;
      }
      .store-node-label {
        font-size: 14px;
        color: #333333;
        text-align: center;
        padding: 0 5px;
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
