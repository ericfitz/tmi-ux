import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ThreatModel, Metadata } from '../../../tm/models/threat-model.model';
import { EntityType } from '../../models/chat.model';
import { isTimmyEnabled } from '../../services/chat-context-builder.service';

export interface EntityToggle {
  id: string;
  name: string;
  type: EntityType;
  enabled: boolean;
}

export interface EntityGroup {
  type: EntityType;
  label: string;
  icon: string;
  entities: EntityToggle[];
}

@Component({
  selector: 'app-chat-source-panel',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './chat-source-panel.component.html',
  styleUrl: './chat-source-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSourcePanelComponent implements OnChanges {
  @Input() threatModel: ThreatModel | null = null;
  @Output() sourceToggled = new EventEmitter<{
    entityId: string;
    type: EntityType;
    enabled: boolean;
  }>();

  groups: EntityGroup[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['threatModel'] && this.threatModel) {
      this.buildGroups();
    }
  }

  onToggle(entity: EntityToggle): void {
    entity.enabled = !entity.enabled;
    this.sourceToggled.emit({
      entityId: entity.id,
      type: entity.type,
      enabled: entity.enabled,
    });
  }

  toggleAll(group: EntityGroup, enabled: boolean): void {
    for (const entity of group.entities) {
      if (entity.enabled !== enabled) {
        entity.enabled = enabled;
        this.sourceToggled.emit({
          entityId: entity.id,
          type: entity.type,
          enabled,
        });
      }
    }
  }

  getEnabledCount(group: EntityGroup): number {
    return group.entities.filter(e => e.enabled).length;
  }

  allEnabled(group: EntityGroup): boolean {
    return group.entities.length > 0 && group.entities.every(e => e.enabled);
  }

  private buildGroups(): void {
    const tm = this.threatModel!;
    this.groups = [
      this.buildGroup(
        'document',
        'chat.entityGroups.documents',
        'description',
        (tm.documents ?? []).map(d => this.toToggle(d, 'document')),
      ),
      this.buildGroup(
        'repository',
        'chat.entityGroups.repositories',
        'source',
        (tm.repositories ?? []).map(r => this.toToggle(r, 'repository')),
      ),
      this.buildGroup(
        'note',
        'chat.entityGroups.notes',
        'note',
        (tm.notes ?? []).map(n => this.toToggle(n, 'note')),
      ),
      this.buildGroup(
        'asset',
        'chat.entityGroups.assets',
        'security',
        (tm.assets ?? []).map(a => this.toToggle(a, 'asset')),
      ),
      this.buildGroup(
        'threat',
        'chat.entityGroups.threats',
        'warning',
        (tm.threats ?? []).map(t => this.toToggle(t, 'threat')),
      ),
      this.buildGroup(
        'diagram',
        'chat.entityGroups.diagrams',
        'account_tree',
        (tm.diagrams ?? []).map(d =>
          this.toToggle(d as { id: string; name: string; metadata?: Metadata[] }, 'diagram'),
        ),
      ),
    ].filter(g => g.entities.length > 0);
  }

  private buildGroup(
    type: EntityType,
    label: string,
    icon: string,
    entities: EntityToggle[],
  ): EntityGroup {
    return { type, label, icon, entities };
  }

  private toToggle(
    entity: { id: string; name: string; metadata?: Metadata[] },
    type: EntityType,
  ): EntityToggle {
    return {
      id: entity.id,
      name: entity.name,
      type,
      enabled: isTimmyEnabled(entity),
    };
  }
}
