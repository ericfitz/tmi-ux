import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZzzComponent } from './zzz.component';
import { LoggerService } from '../../core/services/logger.service';
import { TranslocoTestingModule } from '../../i18n/testing.module';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('ZzzComponent', () => {
  let component: ZzzComponent;
  let fixture: ComponentFixture<ZzzComponent>;
  let loggerServiceSpy: jasmine.SpyObj<LoggerService>;

  beforeEach(async () => {
    loggerServiceSpy = jasmine.createSpyObj('LoggerService', ['info', 'error']);

    await TestBed.configureTestingModule({
      imports: [ZzzComponent, TranslocoTestingModule, NoopAnimationsModule],
      providers: [{ provide: LoggerService, useValue: loggerServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ZzzComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the graph', () => {
    // Use an arrow function to avoid unbound method warning
    const infoFn = (message: string): void => loggerServiceSpy.info(message);
    expect(infoFn).toHaveBeenCalledWith('X6 graph initialized successfully');
  });
});
