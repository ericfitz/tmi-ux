import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { DfdComponent } from './dfd.component';
import { LoggerService } from '../../core/services/logger.service';
import { TranslocoTestingModule } from '../../i18n/testing.module';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// Interface for accessing private methods in tests
interface DfdComponentPrivate {
  initializeGraph: () => void;
}

describe('DfdComponent', () => {
  let component: DfdComponent;
  let fixture: ComponentFixture<DfdComponent>;
  let loggerServiceSpy: jasmine.SpyObj<LoggerService>;

  beforeEach(async () => {
    loggerServiceSpy = jasmine.createSpyObj<LoggerService>('LoggerService', ['info', 'error']);

    await TestBed.configureTestingModule({
      imports: [DfdComponent, TranslocoTestingModule, NoopAnimationsModule],
      providers: [{ provide: LoggerService, useValue: loggerServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(DfdComponent);
    component = fixture.componentInstance;

    // Mock the graph container to have a valid height
    const mockGraphContainer: ElementRef<HTMLElement> = {
      nativeElement: {
        clientWidth: 800,
        clientHeight: 600,
        style: {
          width: '',
          height: '',
        },
        getBoundingClientRect: () => ({ width: 800, height: 600 }) as DOMRect,
      } as HTMLElement,
    };
    component['graphContainer'] = mockGraphContainer;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call initializeGraph method', fakeAsync(() => {
    // Spy on the component's initializeGraph method using our interface
    const componentInstance = component as unknown as DfdComponentPrivate;
    spyOn(componentInstance, 'initializeGraph').and.callThrough();

    // Manually call ngOnInit to trigger the initialization
    component.ngOnInit();

    // Allow the setTimeout to complete
    tick();

    // Check if the initializeGraph method was called
    expect(componentInstance.initializeGraph).toHaveBeenCalled();
  }));
});
