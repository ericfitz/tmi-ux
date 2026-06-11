# Graceful Collaboration-Session Exit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Session end no longer navigates the user anywhere — the DFD editor transitions to solo mode in place with a reason-specific snackbar; the host's "end session for everyone" gets a confirmation dialog; deleted-resource fatal errors are the only path that still navigates.

**Architecture:** Per the approved spec (`docs/superpowers/specs/2026-06-11-collab-session-exit-design.md`). All changes center on `src/app/core/services/dfd-collaboration.service.ts` (remove the redirect calls from five exit paths, add messaging) plus one new method on the collaboration-notification interface/implementation, and a confirm gate in `toggleCollaboration()` using the existing reusable `ConfirmActionDialogComponent`.

**Tech Stack:** Angular, Angular Material dialog/snackbar via the existing `AppNotificationService`, Transloco, Vitest (native syntax, direct class instantiation — the existing `dfd-collaboration.service.spec.ts` already mocks `Router.navigate`).

**Not blocked:** client-only change; no server dependency.

---

## Project conventions

Same as all tmi-ux work (see the project CLAUDE.md): pnpm scripts only; strict TS; `LoggerService`; vitest native syntax with the standard header comment; follow the existing mock setup in `src/app/core/services/dfd-collaboration.service.spec.ts` (it constructs the service directly with mocks, including a mock `Router` with `navigate: vi.fn()`).

## Key code facts (verified 2026-06-11)

- Exit paths and their redirect calls: `leaveSession()` (683–710, calls `_redirectToDashboard()` at 704), `endCollaboration()` (716–794, calls `_redirectToThreatModel()` at 763 and 789), `_handleWebSocketStateChange()` DISCONNECTED branch (1834–1867, role-based redirects at 1857–1863), ERROR/FAILED branch (1868–1890, role-based redirects at 1880–1886), `_handleWebSocketError()` fatal branch (1952–1976, `_redirectToThreatModel()` at 1973).
- `toggleCollaboration()` (1216–1229) is the single UI entry point: `isCollaborating() ? (isCurrentUserHost() ? endCollaboration() : leaveSession()) : startOrJoinCollaboration()`. Both UI call sites (`collaboration.component.ts:148`, `collaboration-dialog.component.ts:334`) go through it. `app-operation-rejection-handler.service.ts:411` calls `endCollaboration()` directly — programmatic, must NOT get a confirm dialog.
- Notifications: the service holds an `@Optional()` `ICollaborationNotificationService` (`src/app/core/interfaces/collaboration-notification.interface.ts`), implemented by `AppNotificationService` (`src/app/pages/dfd/application/services/app-notification.service.ts`, which has `show`/`showPreset`/`showInfo` primitives). `showSessionEvent('ended')` is suppressed by design — do not reuse it; add a new interface method.
- Reusable confirm dialog: `src/app/shared/components/confirm-action-dialog/` — `ConfirmActionDialogComponent` with `ConfirmActionDialogData {title, message, confirmLabel, confirmIsDestructive}`, result `{confirmed: boolean}`. All strings are translation keys.
- `session_terminated` was removed from the AsyncAPI spec (comment at `dfd-collaboration.service.ts:1765`): a participant cannot distinguish host-ended from network loss; both are the unintentional DISCONNECTED path with one merged message.

## File structure

```
Modify: src/app/core/interfaces/collaboration-notification.interface.ts   # + showSoloTransition
Modify: src/app/pages/dfd/application/services/app-notification.service.ts # implement it
Modify: src/app/core/services/dfd-collaboration.service.ts                # remove redirects, add messaging, confirm gate, deletion fallback
Modify: src/app/core/services/dfd-collaboration.service.spec.ts           # update redirect assertions, add new tests
Modify: src/app/pages/dfd/application/services/app-notification.service.spec.ts (if it exists; else cover via collab service spec)
Modify: src/assets/i18n/en-US.json                                         # collaboration.soloTransition.* + endConfirm.* keys
```

---

### Task 1: `showSoloTransition` on the notification interface + implementation

**Files:**
- Modify: `src/app/core/interfaces/collaboration-notification.interface.ts`
- Modify: `src/app/pages/dfd/application/services/app-notification.service.ts`
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add the reason type and interface method**

In `collaboration-notification.interface.ts`, add alongside the existing types:

```typescript
/** Why the collaboration session ended (drives the solo-transition message) */
export type SoloTransitionReason = 'left' | 'ended_by_you' | 'disconnected' | 'error';
```

And add to the `ICollaborationNotificationService` interface:

```typescript
  /**
   * Notify the user that the session ended and they are now working solo.
   * Unlike showSessionEvent('ended') (suppressed by design), this is always shown:
   * it carries the REASON, which the collaboration icon state cannot.
   * @param reason Why the session ended
   * @returns Observable that completes when notification is shown
   */
  showSoloTransition(reason: SoloTransitionReason): Observable<void>;
```

- [ ] **Step 2: Implement in AppNotificationService**

Add to `app-notification.service.ts` (using the service's existing `show`/`showInfo` primitive — match the file's established pattern for translated info messages):

```typescript
  /**
   * Notify the user that the collaboration session ended and they are now
   * working solo. Always shown (unlike showSessionEvent start/end, which the
   * collaboration icon already indicates) because the reason is the payload.
   */
  showSoloTransition(reason: SoloTransitionReason): Observable<void> {
    const keyByReason: Record<SoloTransitionReason, string> = {
      left: 'collaboration.soloTransition.left',
      ended_by_you: 'collaboration.soloTransition.endedByYou',
      disconnected: 'collaboration.soloTransition.disconnected',
      error: 'collaboration.soloTransition.error',
    };
    return this.showInfo(this._transloco.translate(keyByReason[reason]));
  }
```

Import `SoloTransitionReason` from the interface file. (Verify the implementing class declares `implements ICollaborationNotificationService` — if so the compiler enforces the new member; if any other class implements the interface, add the method there too — search for `implements ICollaborationNotificationService`.)

- [ ] **Step 3: Add the master locale keys**

In `src/assets/i18n/en-US.json`, inside the existing `collaboration` object add:

```json
"soloTransition": {
  "left": "You left the collaboration session — you're now working solo.",
  "endedByYou": "You ended the collaboration session — you're now working solo.",
  "disconnected": "The collaboration session ended or the connection was lost — you're now working solo. You can rejoin from the collaboration button.",
  "error": "The collaboration session ended due to an error — you're now working solo."
},
"endConfirm": {
  "title": "End collaboration session?",
  "message": "This ends the session for all participants. Everyone will continue working solo.",
  "confirm": "End session"
},
"resourceDeleted": {
  "diagram": "This diagram was deleted — returning to the threat model.",
  "threatModel": "This threat model was deleted — returning to the dashboard."
}
```

- [ ] **Step 4: Build, then commit**

Run: `pnpm run build` — must compile (the new interface member forces the implementation; nothing calls it yet).

```bash
git add src/app/core/interfaces/collaboration-notification.interface.ts src/app/pages/dfd/application/services/app-notification.service.ts src/assets/i18n/en-US.json
git commit -m "feat(dfd): add solo-transition notification with session-end reason (#274)"
```

---

### Task 2: Remove redirects from the five exit paths; add solo-transition messaging

**Files:**
- Modify: `src/app/core/services/dfd-collaboration.service.ts`
- Modify: `src/app/core/services/dfd-collaboration.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Read the spec file's existing setup first (it constructs the service directly; mock router has `navigate: vi.fn()`; the notification service mock is the `COLLABORATION_NOTIFICATION_SERVICE` shape — add `showSoloTransition: vi.fn().mockReturnValue(of(undefined))` to it). Add a describe block; arrange an active session the same way existing leave/end tests do (reuse their session-setup helpers):

```typescript
  describe('graceful session exit (#274) - no navigation', () => {
    it('leaveSession stays on the page and shows the left message', () => {
      // arrange: active session, current user is NOT host (copy existing leaveSession test arrangement)
      service.leaveSession().subscribe();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('left');
    });

    it('endCollaboration stays on the page and shows the ended-by-you message', () => {
      // arrange: active session, current user IS host; REST end call mocked to succeed
      service.endCollaboration().subscribe();

      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('ended_by_you');
    });

    it('endCollaboration cleans up and messages even when the REST call fails', () => {
      // arrange: REST end call mocked to error
      let errored = false;
      service.endCollaboration().subscribe({ error: () => (errored = true) });

      expect(errored).toBe(true);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('ended_by_you');
    });

    it('unexpected disconnect stays on the page and shows the disconnected message', () => {
      // arrange: active session, NOT intentional; then simulate state change
      // (invoke the same path existing disconnect tests use to drive
      //  _handleWebSocketStateChange with WebSocketState.DISCONNECTED)
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('disconnected');
    });

    it('websocket ERROR stays on the page and shows the error message', () => {
      // arrange + drive WebSocketState.ERROR with an active session
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('error');
    });

    it('fatal websocket error (non-deletion) stays on the page', () => {
      // arrange + drive _handleWebSocketError with a fatal, non-deletion error code
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('error');
    });
  });
```

The `// arrange` comments above are deliberate: the existing spec file already has working arrangements for each of these paths (session setup, websocket state simulation) — copy them rather than inventing new plumbing. The assertions are the contract.

Also UPDATE (do not delete) every existing test that asserts the old redirect behavior — search the spec for `navigate` assertions tied to `leaveSession`/`endCollaboration`/disconnect tests and flip them to `not.toHaveBeenCalled()` with the corresponding `showSoloTransition` assertion.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm run test src/app/core/services/dfd-collaboration.service.spec.ts`
Expected: new tests FAIL (navigation still happens / `showSoloTransition` never called).

- [ ] **Step 3: Implement the five path changes**

In `dfd-collaboration.service.ts`:

1. `leaveSession()` (~704): replace `this._redirectToDashboard();` with:

```typescript
    this._notificationService?.showSoloTransition('left').subscribe();
```

2. `endCollaboration()` success path (~759–763): replace the `showSessionEvent('ended')` call and `this._redirectToThreatModel();` with:

```typescript
          this._notificationService?.showSoloTransition('ended_by_you').subscribe();
```

3. `endCollaboration()` error path (~785–789): same replacement (message still shown; local state was cleaned up).

4. `_handleWebSocketStateChange()` DISCONNECTED branch (~1852–1866): keep `_cleanupSessionState()` and the `sessionEnded$` emission; DELETE the role-based `if (this.isCurrentUserHost()) ... else ...` redirect block entirely; after cleanup add:

```typescript
        this._notificationService?.showSoloTransition('disconnected').subscribe();
```

5. ERROR/FAILED branch (~1874–1890): same surgery — keep cleanup + `sessionEnded$`, delete the role-based redirect block, add:

```typescript
          this._notificationService?.showSoloTransition('error').subscribe();
```

6. `_handleWebSocketError()` fatal branch (~1972–1973): replace `this._redirectToThreatModel();` with the deletion-fallback logic from Task 3 — for THIS task, just:

```typescript
    this._notificationService?.showSoloTransition('error').subscribe();
```

7. Delete `_redirectToDashboard()` (2081–2090) and `_redirectToThreatModel()` (2095–2109) — after Task 3 they have no callers in their old form (Task 3 adds a narrower fallback navigation; if you implement Tasks 2+3 together keep whichever helper the fallback reuses). If implementing strictly in order, defer the deletion to Task 3's cleanup step.

`leaveSession()` keeps `_intentionalDisconnection = true` and `_cleanupSessionState()` unchanged — only the navigation goes. Note: the DISCONNECTED intentional branch (1836–1845) fires AFTER `leaveSession`/`endCollaboration` already messaged; it must NOT message again (it currently just emits `sessionEnded$` — leave it as is).

- [ ] **Step 4: Run the full service spec**

Run: `pnpm run test src/app/core/services/dfd-collaboration.service.spec.ts`
Expected: PASS — new tests and updated pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/
git commit -m "feat(dfd): stay on diagram in solo mode when collaboration ends (#274)"
```

---

### Task 3: Deletion fallback — the one remaining navigation

**Files:**
- Modify: `src/app/core/services/dfd-collaboration.service.ts`
- Modify: `src/app/core/services/dfd-collaboration.service.spec.ts`

- [ ] **Step 1: Verify the server's deletion error codes**

Check the AsyncAPI spec (`api-schema/tmi-asyncapi.yaml`, local tmi clone or `https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/dev/1.4.0/api-schema/tmi-asyncapi.yaml`) for the error message enum: find the codes sent when the diagram or threat model is deleted during a session (expected shapes like `diagram_not_found` / `threat_model_not_found` — use the exact published values). If no such codes exist in the spec, implement the fallback for the codes that do indicate the resource is gone, and note the gap in the issue when closing out.

- [ ] **Step 2: Write the failing tests**

```typescript
  describe('deletion fallback navigation (#274)', () => {
    it('navigates to the threat model when the diagram was deleted', () => {
      // arrange: active session; drive _handleWebSocketError with the
      // verified diagram-deleted error code (fatal path)
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/tm', 'tm-id-from-arrangement']);
    });

    it('navigates to the dashboard when the threat model was deleted', () => {
      // arrange: drive the threat-model-deleted error code
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('other fatal errors do not navigate', () => {
      // arrange: drive a generic fatal error code
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 3: Run to verify they fail, then implement**

In `_handleWebSocketError()`'s fatal branch, after `_cleanupSessionState()` and the error notification, replace the Task 2 placeholder messaging with:

```typescript
    if (message.error === 'diagram_not_found') {
      // The diagram no longer exists - staying on the editor is impossible.
      this._notificationService
        ?.showInfo(this._transloco.translate('collaboration.resourceDeleted.diagram'))
        .subscribe();
      void this._router.navigate(['/tm', this._threatModelId]);
    } else if (message.error === 'threat_model_not_found') {
      this._notificationService
        ?.showInfo(this._transloco.translate('collaboration.resourceDeleted.threatModel'))
        .subscribe();
      void this._router.navigate(['/dashboard']);
    } else {
      this._notificationService?.showSoloTransition('error').subscribe();
    }
```

(Substitute the exact error codes verified in Step 1. If `showInfo` is not on `ICollaborationNotificationService`, add it to the interface — `AppNotificationService` already implements a `showInfo(message): Observable<void>`.) Then delete the now-unused `_redirectToDashboard()`/`_redirectToThreatModel()` helpers (per Task 2 step 3 item 7).

- [ ] **Step 4: Run the full service spec — PASS. Commit.**

```bash
git add src/app/core/services/ src/app/core/interfaces/
git commit -m "feat(dfd): navigate away only when the diagram or TM was deleted (#274)"
```

---

### Task 4: Host end-session confirmation

**Files:**
- Modify: `src/app/core/services/dfd-collaboration.service.ts` (`toggleCollaboration()`, 1216–1229)
- Modify: `src/app/core/services/dfd-collaboration.service.spec.ts`

The confirm gate lives in `toggleCollaboration()` so both UI call sites (collaboration button, collaboration dialog) get it, while the programmatic caller (`app-operation-rejection-handler.service.ts:411`, which calls `endCollaboration()` directly) bypasses it by design.

- [ ] **Step 1: Write the failing tests**

Add `MatDialog` to the service's constructor mocks in the spec (e.g. `mockDialog = { open: vi.fn() }` passed in constructor order):

```typescript
  describe('host end-session confirmation (#274)', () => {
    it('asks for confirmation before ending; cancel keeps the session alive', () => {
      // arrange: active session, current user IS host
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ confirmed: false }) });

      let result: boolean | undefined;
      service.toggleCollaboration().subscribe(r => (result = r));

      expect(mockDialog.open).toHaveBeenCalled();
      expect(result).toBe(false);
      // session untouched: end REST call not made
      expect(mockThreatModelService.endDiagramCollaborationSession).not.toHaveBeenCalled();
    });

    it('confirm proceeds to end the session', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ confirmed: true }) });

      service.toggleCollaboration().subscribe();

      expect(mockThreatModelService.endDiagramCollaborationSession).toHaveBeenCalled();
    });

    it('participant leave does not ask for confirmation', () => {
      // arrange: active session, current user NOT host
      service.toggleCollaboration().subscribe();
      expect(mockDialog.open).not.toHaveBeenCalled();
    });

    it('direct endCollaboration() is not gated (programmatic callers)', () => {
      service.endCollaboration().subscribe();
      expect(mockDialog.open).not.toHaveBeenCalled();
    });
  });
```

(Mock names per the spec file's conventions; `mockThreatModelService` is whatever the file calls its `THREAT_MODEL_SERVICE` mock.)

- [ ] **Step 2: Run to verify they fail, then implement**

1. Inject `MatDialog` into the service constructor (`private _dialog: MatDialog`, import from `@angular/material/dialog`); update the spec's construction accordingly.
2. Replace `toggleCollaboration()`'s collaborating branch:

```typescript
    if (this.isCollaborating()) {
      if (!this.isCurrentUserHost()) {
        return this.leaveSession();
      }
      // Ending affects every participant - confirm first (tmi-ux#274)
      return this._dialog
        .open<ConfirmActionDialogComponent, ConfirmActionDialogData, ConfirmActionDialogResult>(
          ConfirmActionDialogComponent,
          {
            width: '450px',
            data: {
              title: 'collaboration.endConfirm.title',
              message: 'collaboration.endConfirm.message',
              confirmLabel: 'collaboration.endConfirm.confirm',
              confirmIsDestructive: true,
            },
            disableClose: true,
          },
        )
        .afterClosed()
        .pipe(
          switchMap(result => (result?.confirmed ? this.endCollaboration() : of(false))),
        );
    }
```

Imports: `ConfirmActionDialogComponent` and the two types from `@app/shared/components/confirm-action-dialog/confirm-action-dialog.component`; `of`/`switchMap` are already imported in this file (verify; add if not). Check `ConfirmActionDialogComponent`'s template: `confirmIsDestructive: true` renders the warn-styled primary; the dialog already follows the project's destructive-focus rule.

- [ ] **Step 3: Run the full service spec — PASS. Lint + build clean. Commit.**

```bash
git add src/app/core/services/
git commit -m "feat(dfd): confirm before host ends collaboration for everyone (#274)"
```

---

### Task 5: Solo-mode transition sanity (presenter visuals + dialog state)

**Files:**
- Verify (and only modify if broken): `src/app/core/services/dfd-collaboration.service.ts` `_cleanupSessionState()` (2063–2076), the presenter-mode visual layer, `collaboration-dialog.component.ts`

- [ ] **Step 1:** Trace what consumes `collaborationState$` / `sessionEnded$` for presenter visuals (remote cursors, remote selections, presenter highlights — search `src/app/pages/dfd/` for subscribers). Confirm `_cleanupSessionState()`'s `isPresenterModeActive: false` + empty `users` propagates to clearing them. If any visual artifact survives session end (e.g., a remote cursor layer cleared only on navigation/destroy — which used to happen implicitly because we navigated away!), clear it in response to `sessionEnded$`. This is the one place the old behavior masked a gap: components were destroyed by navigation; now they live on.
- [ ] **Step 2:** Confirm the collaboration dialog, if open when the session ends, reflects the no-session state via its `collaborationState$` subscription (it should; it's reactive). If it renders stale participants, fix its subscription.
- [ ] **Step 3:** Confirm no collaboration-mode flag blocks solo REST saves after cleanup (search for guards on `isActive`/`isCollaborating()` in the DFD save path — e.g. the orchestrator/persistence services in `src/app/pages/dfd/application/`). Saves must flow once `isActive` is false.
- [ ] **Step 4:** Add regression tests for anything fixed; if nothing needed fixing, state that in the commit/issue notes rather than inventing tests.
- [ ] **Step 5:** Commit if changes were made: `fix(dfd): clear presenter visuals when session ends without navigation (#274)`.

---

### Task 6: Localization backfill

- [ ] **Step 1:** Invoke the `localization-backfill` (or `loc:backfill`) skill to translate the new `collaboration.soloTransition.*`, `collaboration.endConfirm.*`, `collaboration.resourceDeleted.*` keys into all locales.
- [ ] **Step 2:** Run the `check_command` from `.claude/i18n.config.json`; confirm no missing keys.
- [ ] **Step 3:** Commit: `chore(i18n): localize collaboration solo-transition strings (#274)`.

---

### Task 7: Final verification

- [ ] **Step 1:** `pnpm run lint:all` — fix everything.
- [ ] **Step 2:** `pnpm run build` — fix all errors.
- [ ] **Step 3:** `pnpm test` — full suite, no failures, no skips.
- [ ] **Step 4:** Invoke `superpowers:requesting-code-review` before final commit.
- [ ] **Step 5: Manual smoke check** (two browsers, one host + one participant): participant leaves → stays on diagram, snackbar, can edit solo; host clicks end → confirm dialog → cancel keeps session → confirm ends it; participant side stays on diagram with the merged disconnected message; kill the server mid-session → both stay with the disconnected message; collaboration button shows rejoinable state where applicable.
- [ ] **Step 6: Close out** — comment on tmi-ux#274 referencing the commits and close it explicitly (`gh issue comment 274 --body "..."` then `gh issue close 274`); commits on `dev/1.4.0` do not auto-close.
