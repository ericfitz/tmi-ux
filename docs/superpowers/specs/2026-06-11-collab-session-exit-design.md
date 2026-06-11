# Graceful Collaboration-Session Exit — Design

- **Issue:** [tmi-ux#274](https://github.com/ericfitz/tmi-ux/issues/274)
- **Status:** Design approved 2026-06-11. Not blocked — client-only change.

## Summary

Today every collaboration-session exit force-navigates the user (participants → `/dashboard`, hosts → `/tm/{id}`), with little or no explanation. The fix decouples *session end* from *page navigation*: the user stays on the DFD editor, which transitions to solo mode in place; a snackbar explains what happened; the existing collaboration icon remains the persistent state indicator. A new confirmation dialog protects the host's "end session for everyone" action.

## Decisions made during design

| Decision | Choice | Rationale |
|---|---|---|
| Core principle | Stay in place; no navigation on session end | Session ending and leaving the page are different events. Solo DFD editing is the default mode (collaboration is layered on top), so the editor works without a session. Eliminates the yank instead of softening it. |
| Permission safety | Verified | Participant permissions derive from threat-model permissions (`dfd-collaboration.service.ts:38`), so every participant has at least reader access — staying on the diagram (read-only for readers) is always permission-safe. |
| Host end-session | Confirmation dialog first | One accidental click currently kills the session for all participants. |
| Messaging | Transient snackbar per exit reason + existing collab icon state | Matches existing notification patterns; the icon (green → blue/default) already communicates persistent session state. |
| Reconnection | Out of scope | Auto-reconnect code is deliberately disabled (`websocket.adapter.ts:759-822`); a grace period is its own issue if wanted. |

## Per-path behavior

All exit paths live in `src/app/core/services/dfd-collaboration.service.ts`. The change removes the `_redirectToDashboard()` / `_redirectToThreatModel()` calls from each and adds reason-specific messaging. The existing `sessionEnded$` reasons (`user_ended` / `disconnected` / `error`) drive which message shows.

| # | Path | Method (current lines) | Today | New behavior |
|---|---|---|---|---|
| 1 | Participant clicks "Leave session" | `leaveSession()` (683–710) | → `/dashboard`, silent | Stay, solo mode; snackbar "You left the collaboration session." |
| 2 | Host ends session | `endCollaboration()` (716–794) | → `/tm/{id}`, suppressed notification | **Confirm dialog first**: "End the session for all participants?" — destructive primary (`mat-flat-button color="warn"`), `cdkFocusInitial` on Cancel per the button standard. Then stay, solo; snackbar "You ended the collaboration session." |
| 3+4 | Session ended remotely OR unexpected WebSocket disconnect | `_handleWebSocketStateChange()` (1834–1867) | role-based navigation + warning | Stay, solo; snackbar "The collaboration session ended or the connection was lost — you're now working solo. You can rejoin from the collaboration button." **Note:** the `session_terminated` WebSocket message was removed from the AsyncAPI spec (`dfd-collaboration.service.ts:1765`), so a host-ended session and a network loss are indistinguishable to a participant — both arrive as an unintentional `DISCONNECTED`. One honest merged message covers both. |
| 5 | WebSocket error / fatal server error | `_handleWebSocketStateChange()` (1868–1890), `_handleWebSocketError()` (1922–1977) | role-based / → `/tm/{id}` | Stay, solo; existing error notification plus the solo-mode snackbar. |

## Solo-mode transition mechanics

`_cleanupSessionState()` (2063–2076) already clears participants/presenter state. Additional requirements:

- Presenter-mode visuals — remote cursors, remote selections, presenter highlights — are fully cleared from the canvas on session end.
- Writers' subsequent edits flow through the normal solo REST save path (this is the editor's default behavior once the session state is cleared; verify no collaboration-mode flag blocks local saves).
- Readers remain in the editor's existing read-only mode.
- The collaboration dialog (if open when the session ends) closes or refreshes to the no-session state.

## Fallback navigation (the one exception)

If the session ended because the diagram or threat model no longer exists (deleted during the session — detected via the fatal WebSocket error codes the server sends for deleted resources; no proactive post-session refresh call is added):

- Diagram gone, TM exists → navigate to `/tm/{threatModelId}` with snackbar "This diagram was deleted."
- TM gone → navigate to `/dashboard` with snackbar "This threat model was deleted."

This is the only navigation in the feature.

## Out of scope

- Auto-reconnect / reconnection grace period (deliberately disabled; file separately if wanted).
- Changes to join/invite flows or the collaboration dialog beyond the no-session refresh.
- The notification-suppression framework (plain snackbars via the existing notification service).

## i18n

New localized strings: the four solo-transition snackbar messages, the two deletion-fallback messages, and the host-end confirm dialog (title/body/confirm). Master locale + backfill.

## Testing

Unit tests in `dfd-collaboration.service` specs, one group per exit path, asserting: **no router navigation occurs**, session state is cleaned up, and the correct snackbar reason is emitted. Dialog test: host-end confirm — cancel aborts (session continues), confirm ends. Fallback tests: diagram-deleted → `/tm/{id}` navigation; TM-deleted → `/dashboard`. Existing specs that assert the old redirect behavior must be updated to assert the new behavior (not deleted).
