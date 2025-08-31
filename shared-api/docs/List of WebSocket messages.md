List of WebSocket Messages with Implementation Status

Client → Server Messages

| Message             | Server Implemementation                             | Client Implementation |
| ------------------- | --------------------------------------------------- | --------------------- |
| diagram_operation   | ✓ processDiagramOperation (api/websocket.go:1511)   |                       |
| presenter_request   | ✓ processPresenterRequest (api/websocket.go:1633)   |                       |
| change_presenter    | ✓ processChangePresenter (api/websocket.go:1697)    |                       |
| presenter_cursor    | ✓ processPresenterCursor (api/websocket.go:1766)    |                       |
| presenter_selection | ✓ processPresenterSelection (api/websocket.go:1794) |                       |
| resync_request      | ✓ processResyncRequest (api/websocket.go:1822)      |                       |
| undo_request        | ✓ processUndoRequest (api/websocket.go:1858)        |                       |
| redo_request        | ✓ processRedoRequest (api/websocket.go:1932)        |                       |

Server → Client Messages

| Message              | Server Implemementation                                           | Client Implementation |
| -------------------- | ----------------------------------------------------------------- | --------------------- |
| join                 | ✓ Event sent when user joins session                              |                       |
| leave                | ✓ Event sent when user leaves session                             |                       |
| update               | ✓ Broadcasts diagram operations to all clients                    |                       |
| session_ended        | ✓ Sent when host disconnects                                      |                       |
| presenter_denied     | ✓ Sent to requester when presenter request is denied              |                       |
| current_presenter    | ✓ Broadcast when presenter changes                                |                       |
| authorization_denied | ✓ Sent via sendAuthorizationDenied (api/websocket.go:2490)        |                       |
| state_correction     | ✓ Sent via sendStateCorrection (api/websocket.go:2505)            |                       |
| resync_response      | ✓ Sent in response to resync requests                             |                       |
| history_operation    | ✓ Sent for undo/redo operation results                            |                       |
| participants_update  | ✓ Sent via sendParticipantsUpdateToClient (api/websocket.go:2365) |                       |
