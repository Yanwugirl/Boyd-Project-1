# Complete three-act implementation

## Scene lifecycle

The manifest registers all three acts. Act I uses the existing chat page. Act II and Act III use `mount({host, state, emit})`, returning `update`, `updateStage`, and `destroy`. The controller retains one socket, room, and seat identity, removes the previous scene, and waits for both modules to load before the shared start time. Reconnect restores the current phase. Completed sessions retain Act III for a readable final view.

## Act II

`lib/act2.cjs` owns the asymmetric game, original-signal consent, paired movement, collision, role exchange, and the joined key. Geometry is shared through `public/acts/act2-layout.json`. Private clues are sent only in the current guide's per-player game view. The Act I x/y reveal is authorized only after both clients enter Act II.

Both participants' final consent creates `journey.handoff` with the joined key, both fragments, recovered message IDs, and a closed shell. Act III consumes this existing handoff inside the same room.

## Act III

`lib/act3.cjs` owns three states, sealed, conversation, and complete. Player 1 offers or withdraws the shared key. Player 2 can request it, defer an invitation, or accept it. Acceptance updates the handoff's shell to open and starts a short shared opening interval. The server rejects message sends until this interval has elapsed.

`act3:action` validates key actions and the two final closing votes. `act3:send` validates a per-message client ID and up to 2000 UTF-16 units of text. Text is stored verbatim and never passed through `room.engine`. Both roles can send concurrently. Repeating the same retained ID and text returns the original receipt without appending another message. Reusing the ID with different text is rejected.

The direct transcript is separate from Act I's x/y array. The room retains its latest 500 final-act messages. The user's own client IDs are returned only in their view. A successful new message cancels pending closing votes. `act3:typing` is a lightweight, expiring peer notification over `stage:state`.

Disconnect cancels incomplete invitations and end votes while retaining an opened shell, transcript, completed game, and identities. Browser session storage retains a role-specific unsent draft and pending message ID. The Node process retains delivered data only in memory.

After both closing votes, `room.phase` becomes `complete`, the journey marks all three acts complete, and Act III displays its ending. The transcript can be reopened read-only. Completion remains visible when either participant subsequently disconnects.

## Files and validation

- Server rules live in `server.cjs`, `lib/journey.cjs`, `lib/act2.cjs`, and `lib/act3.cjs`.
- The final scene and its illustration live in `public/acts/act3.mjs` and `public/acts/act3.css`.
- The complete network test in `test/act2.test.cjs` traverses all three acts and verifies final text and model independence.
- `test/act3.test.cjs` checks invite authority, deferral, timing, exact text, retry IDs, pause handling, completion, validation, and bounded rolling history.

The optional gesture adapter remains in `public/gesture.js`. It supplies button dwell and destination selection in Act II. Free text entry uses the textarea. Physical hand tracking still needs local device validation.
