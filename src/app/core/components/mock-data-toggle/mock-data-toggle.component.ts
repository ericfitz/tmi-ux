import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Observable } from 'rxjs';
import { MockDataService } from '../../../mocks/mock-data.service';
import { LoggerService } from '../../services/logger.service';

/**
 * Component that provides a toggle for switching between mock and real data
 * This is intended to be used in the navbar during development
 */
@Component({
  selector: 'app-mock-data-toggle',
  standalone: true,
  imports: [CommonModule, MatSlideToggleModule],
  template: `
    <mat-slide-toggle
      [checked]="useMockData$ | async"
      (change)="toggleMockData($event.checked)"
      color="accent"
      class="mock-data-toggle"
    >
      <span class="mock-data-label">Mock Data</span>
    </mat-slide-toggle>
  `,
  styles: [
    `
      .mock-data-toggle {
        margin-left: 16px;
      }
      .mock-data-label {
        font-size: 12px;
        margin-left: 4px;
        color: white;
      }
    `,
  ],
})
export class MockDataToggleComponent implements OnInit {
  // Observable of the mock data state
  useMockData$!: Observable<boolean>;

  constructor(
    private mockDataService: MockDataService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.useMockData$ = this.mockDataService.useMockData$;
    this.logger.debug('MockDataToggleComponent initialized');
  }

  /**
   * Toggle the use of mock data
   * @param useMock Boolean indicating whether to use mock data
   */
  toggleMockData(useMock: boolean): void {
    this.mockDataService.toggleMockData(useMock);
    this.logger.info(`Mock data ${useMock ? 'enabled' : 'disabled'}`);
  }
}
