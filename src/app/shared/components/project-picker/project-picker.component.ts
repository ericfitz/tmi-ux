import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectChange } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ProjectService } from '@app/core/services/project.service';
import { LoggerService } from '@app/core/services/logger.service';
import { ProjectListItem } from '@app/types/project.types';
import {
  CreateProjectDialogComponent,
  CreateProjectDialogResult,
} from '../create-project-dialog/create-project-dialog.component';

@Component({
  selector: 'app-project-picker',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <div class="project-picker-row">
      <mat-form-field appearance="outline" class="project-field">
        <mat-label [transloco]="'projects.picker.label'">Project</mat-label>
        @if (loading) {
          <mat-select [value]="projectId" disabled>
            <mat-option>{{ 'common.loading' | transloco }}</mat-option>
          </mat-select>
        } @else {
          <mat-select
            [value]="projectId"
            [disabled]="disabled"
            (selectionChange)="onSelectionChange($event)"
          >
            <mat-option [value]="null">{{ 'projects.picker.none' | transloco }}</mat-option>
            @for (project of projects; track project.id) {
              <mat-option [value]="project.id">{{ project.name }}</mat-option>
            }
          </mat-select>
        }
      </mat-form-field>
      @if (!disabled) {
        <button
          mat-icon-button
          type="button"
          (click)="openCreateProject()"
          [matTooltip]="'projects.createNew' | transloco"
        >
          <mat-icon>add</mat-icon>
        </button>
      }
    </div>
  `,
  styles: [
    `
      .project-picker-row {
        display: flex;
        align-items: flex-start;
        gap: 4px;

        > button {
          margin-top: 8px;
        }
      }

      .project-field {
        flex: 1;
        min-width: 200px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: select an existing project or create a new one via a dropdown and dialog
export class ProjectPickerComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  @Input() projectId: string | null = null;
  @Input() disabled = false;
  @Output() projectChange = new EventEmitter<string | null>();

  projects: ProjectListItem[] = [];
  loading = true;

  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: inject dialog, project service, logger, and change detector dependencies (pure)
  constructor(
    private dialog: MatDialog,
    private projectService: ProjectService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: fetch the project list on component initialization (reads DB)
  ngOnInit(): void {
    this.loadProjects();
  }

  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: fetch the project list from the API and populate the picker (reads DB)
  private loadProjects(): void {
    this.loading = true;
    this.projectService
      .list({ limit: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.projects = response.projects;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: emit the selected project ID when the dropdown selection changes (pure)
  onSelectionChange(event: MatSelectChange): void {
    this.projectChange.emit(event.value as string | null);
  }

  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: open the create-project dialog, persist the result, and add it to the project list
  openCreateProject(): void {
    const dialogRef = this.dialog.open(CreateProjectDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: CreateProjectDialogResult | undefined) => {
        if (!result) return;

        this.projectService
          .create(result)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: newProject => {
              this.projects = [
                ...this.projects,
                {
                  id: newProject.id,
                  name: newProject.name,
                  description: newProject.description,
                  status: newProject.status,
                  team_id: newProject.team_id,
                  created_at: newProject.created_at,
                },
              ];
              this.projectId = newProject.id;
              this.projectChange.emit(newProject.id);
              this.cdr.markForCheck();
            },
            error: error => {
              this.logger.error('Failed to create project', error);
            },
          });
      });
  }
}
