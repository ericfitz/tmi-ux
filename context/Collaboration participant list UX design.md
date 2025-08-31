Collaboration participant list UX design note

In the Manage Collaboration dialog, I want to change the design of the list of users that are participants in this session. We will completely replace the current list, and we will remove the "Presenter Controls" section of the dialog and the buttons in that section.

The participant list will have one row (list item) per participant in the session.

For each user in the list of participants, I want 5 columns. None of the columns will have titles.

The first column will be the "user type" column. It will always display a material icons font glyph. If the user is the "Session Manager", then this column will display the "Person Shield" icon. Otherwise, this column will display the "Person" icon. The icon will have a localized tooltip, either "Session Manager" (common.sessionRoles.sessionManager) for session managers, or "Participant" (common.sessionRoles.participant) for participants.

The second column will be the "permissions" column. If the user has "reader" permissions in the session, then this column will display the "Edit Off" icon. If the user has "writer" permissions in the session, then this column will display the "Edit" icon. The icon will have a localized tooltip, either common.roles.reader or common.roles.writer, depending on the user's collaboration permissions.

The third column will be the "user" column. It will show the username of the user. This field will have a non-localized tooltip with the name of the user.

The fourth column will be the "presenter" column. The presenter column will show a button. The icon, tooltip and function of the button will be as follows:
| Is user the Session Manager? | Is User the Presenter? | Material Icon | Tooltip (localization key name) | Action on button click |
|------|------|------|------|------|
| True | True | Podium (no overlay) | common.sessionRoles.presenter | n/a |
| True | False | Podium () | none/not displayed | n/a |
| False | True | Podium ("Close" icon overlay, lower right) | takeBackPresenter | change presenter to session manager (1) |
| False | False | (2) | (2) | (2) |

(1) The application will immediately send a "change presenter" message on the websocket, to change the presenter to the session manager.

(2) The Person Raised Hand icon will normally be the theme default color for icons. The button will be stateful for each user. The button states will be hand down, hand raised, and presenter, and states will transition as follows:

In the hand down state, the icon will be "Person Raised Hand" with the default color for button icons and with a tooltip localization key of "requestPresenter". Clicking the button will change to the hand raised state and will send a presenter_request message for the current user.

In the hand raised state, the icon will be the "Person Raised Hand" icon in our standard green color, and the tooltip will be "Presenter Mode Requested" (localized). The hand raised state will transition to the "hand down" state if the client receives a "presenter_denied" message while in the hand raised state. While in the hand_raised state, if a change_presenter message is received, then the state will change based on the user identified as the new presenter. If the new presenter is the current user, the user will change to the "presenter" state and the icon will change to the Podium icon (default color) with a tooltip of common.sessionRoles.presenter. If the new presenter is NOT the current user, then the user will transition to the "hand down" state.

In the presenter state, if a "change_presenter" message is received, and the new presenter is the current user, no action will be taken, but if the new presenter is NOT the current user, then the user will be returned to the "hand down" state.

The fifth column will be the "Remove User" column. If the user is the Session Manager, this column will be empty. If the user is not the Session Manager, then this column will display a button showing the "Person Cancel" icon, and clicking the button will remove the user from the collaboration session. If the button is displayed, it will have a tooltip using the localization key removeFromSession.
