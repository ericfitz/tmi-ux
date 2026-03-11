import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  OnInit,
  Optional,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { MatTabsModule } from '@angular/material/tabs';
import { forkJoin, identity, MonoTypeOperatorFunction } from 'rxjs';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '../../../../core/services/logger.service';
import { ThreatModel } from '../../../tm/models/threat-model.model';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { ChatMessage, ChatSession, TIMMY_METADATA_KEY } from '../../models/chat.model';
import { ChatService } from '../../services/chat.service';
import { MockChatService } from '../../services/mock-chat.service';
import { ChatContextBuilderService } from '../../services/chat-context-builder.service';
import { ChatSessionStorageService } from '../../services/chat-session-storage.service';
import { ChatMessagesComponent } from '../chat-messages/chat-messages.component';
import { ChatSourcePanelComponent } from '../chat-source-panel/chat-source-panel.component';
import { ChatSessionPanelComponent } from '../chat-session-panel/chat-session-panel.component';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatTabsModule,
    TranslocoModule,
    ChatMessagesComponent,
    ChatSourcePanelComponent,
    ChatSessionPanelComponent,
  ],
  providers: [{ provide: ChatService, useClass: MockChatService }],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPageComponent implements OnInit {
  threatModel: ThreatModel | null = null;
  threatModelId = '';
  messages: ChatMessage[] = [];
  sessions: ChatSession[] = [];
  activeSessionId: string | null = null;
  loading = false;
  sidePanelOpen = true;

  private pendingToggles = new Map<string, { type: string; enabled: boolean }>();
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private contextBuilder: ChatContextBuilderService,
    private sessionStorage: ChatSessionStorageService,
    private threatModelService: ThreatModelService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    @Optional() private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.threatModelId = this.route.snapshot.paramMap.get('id') ?? '';
    this.threatModel = (this.route.snapshot.data['threatModel'] as ThreatModel) ?? null;

    void this.loadSessions();
  }

  navigateBack(): void {
    void this.router.navigate(['/tm', this.threatModelId]);
  }

  toggleSidePanel(): void {
    this.sidePanelOpen = !this.sidePanelOpen;
  }

  async onMessageSent(text: string): Promise<void> {
    if (!this.threatModel) return;

    // Create session if none active
    if (!this.activeSessionId) {
      const title = text.length > 50 ? text.substring(0, 47) + '...' : text;
      const session = await this.sessionStorage.createSession(this.threatModelId, title);
      this.activeSessionId = session.id;
      await this.refreshSessions();
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: this.activeSessionId,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    this.messages = [...this.messages, userMessage];
    await this.sessionStorage.appendMessage(this.activeSessionId, userMessage);

    // Get response
    this.loading = true;
    this.cdr.markForCheck();

    const context = this.contextBuilder.buildContext(this.threatModel);
    this.chatService
      .sendMessage(text, context, this.messages)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: response => {
          response.sessionId = this.activeSessionId!;
          this.messages = [...this.messages, response];
          this.loading = false;
          void this.sessionStorage
            .appendMessage(this.activeSessionId!, response)
            .then(() => this.refreshSessions())
            .then(() => this.cdr.markForCheck());
        },
        error: err => {
          this.logger.error('Chat service error', err);
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onSourceToggled(event: { entityId: string; type: string; enabled: boolean }): void {
    this.pendingToggles.set(event.entityId, event);
    this.debounceSave();
  }

  async onSessionSelected(sessionId: string): Promise<void> {
    const session = await this.sessionStorage.getSession(sessionId);
    if (session) {
      this.activeSessionId = session.id;
      this.messages = [...session.messages];
      this.cdr.markForCheck();
    }
  }

  onSessionCreated(): void {
    this.activeSessionId = null;
    this.messages = [];
    this.cdr.markForCheck();
  }

  async onSessionDeleted(sessionId: string): Promise<void> {
    await this.sessionStorage.deleteSession(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
      this.messages = [];
    }
    await this.refreshSessions();
    this.cdr.markForCheck();
  }

  private async loadSessions(): Promise<void> {
    this.sessions = await this.sessionStorage.listSessions(this.threatModelId);
    this.cdr.markForCheck();
  }

  private async refreshSessions(): Promise<void> {
    this.sessions = await this.sessionStorage.listSessions(this.threatModelId);
  }

  private debounceSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.flushTogglesToModel();
      this.saveDebounceTimer = null;
    }, 2000);
  }

  private flushTogglesToModel(): void {
    if (!this.threatModel) return;

    const updateMethods: Record<
      string,
      (
        tmId: string,
        entityId: string,
        metadata: { key: string; value: string }[],
      ) => ReturnType<typeof this.threatModelService.updateAssetMetadata>
    > = {
      document: (tmId, eid, m) => this.threatModelService.updateDocumentMetadata(tmId, eid, m),
      repository: (tmId, eid, m) => this.threatModelService.updateRepositoryMetadata(tmId, eid, m),
      note: (tmId, eid, m) => this.threatModelService.updateNoteMetadata(tmId, eid, m),
      asset: (tmId, eid, m) => this.threatModelService.updateAssetMetadata(tmId, eid, m),
      threat: (tmId, eid, m) => this.threatModelService.updateThreatMetadata(tmId, eid, m),
      diagram: (tmId, eid, m) => this.threatModelService.updateDiagramMetadata(tmId, eid, m),
    };

    const saves = [];
    for (const [entityId, toggle] of this.pendingToggles) {
      const metadata = this.buildEntityMetadata(entityId, toggle.type, toggle.enabled);
      if (metadata && updateMethods[toggle.type]) {
        saves.push(updateMethods[toggle.type](this.threatModelId, entityId, metadata));
      }
    }
    this.pendingToggles.clear();

    if (saves.length > 0) {
      forkJoin(saves)
        .pipe(this.untilDestroyed())
        .subscribe({
          error: err => this.logger.error('Failed to save timmy toggles', err),
        });
    }
  }

  private buildEntityMetadata(
    entityId: string,
    type: string,
    enabled: boolean,
  ): { key: string; value: string }[] | null {
    const tm = this.threatModel!;
    const collections: Record<
      string,
      { id: string; metadata?: { key: string; value: string }[] }[]
    > = {
      document: tm.documents ?? [],
      repository: tm.repositories ?? [],
      note: tm.notes ?? [],
      asset: tm.assets ?? [],
      threat: tm.threats ?? [],
      diagram: tm.diagrams ?? [],
    };

    const entities = collections[type];
    if (!entities) return null;

    const entity = entities.find(e => e.id === entityId);
    if (!entity) return null;

    if (!entity.metadata) entity.metadata = [];

    const metaIndex = entity.metadata.findIndex(m => m.key === TIMMY_METADATA_KEY);
    if (enabled) {
      if (metaIndex >= 0) entity.metadata.splice(metaIndex, 1);
    } else {
      if (metaIndex >= 0) {
        entity.metadata[metaIndex].value = 'false';
      } else {
        entity.metadata.push({ key: TIMMY_METADATA_KEY, value: 'false' });
      }
    }

    return [...entity.metadata];
  }

  /**
   * Helper to conditionally apply takeUntilDestroyed
   */
  private untilDestroyed<T>(): MonoTypeOperatorFunction<T> {
    return this.destroyRef ? takeUntilDestroyed<T>(this.destroyRef) : identity;
  }
}
