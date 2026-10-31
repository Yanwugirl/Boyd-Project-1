# Verification · 31 October 2026

## Completed

- `npm ci` completed with the pinned dependency lockfile; JavaScript syntax checks passed.
- Seven automated tests passed. They open real WebSocket Socket.IO clients against the Node server and check role order, distinct rooms, private x/y views, occupied-seat rejection, disconnected sending, reconnection, contribution gates, the two-person ending, input validation, and model-error retry.
- The Ollama adapter was tested against a local HTTP fixture: `/api/tags`, structured `/api/chat`, `stream: false`, reading `message.content`, malformed JSON, empty output and overlong output.
- In the cloud browser, two live tabs joined one room as human/robot, exchanged messages in both directions, and displayed the sender's original line and the recipient's transformed line. This browser run used **labelled scripted rehearsal mode**.
- Refreshing the first tab restored its role and transcript. Both tabs separately chose to leave and reached **End of Act I**.
- The actual p5 room, person and robot-shell views were visually inspected in the browser. The final source-backed visual preview was also inspected.
- The hand library's pinned `ml5@1.3.1` release and the cited official p5/ml5 HandPose API were checked. The camera requires a secure context; plain LAN HTTP is supported for mouse messages.
- SVG exports and p5 primitive data share the same coordinates. Asset SHA-256 checks are included in the handoff manifest.

## Still requires Jiaming's computer / hardware

- No actual Ollama model was installed or run in this executor. The adapter fixture is not proof of real model wording, speed, or instruction following. Use `npm start` with Ollama open and the model downloaded, then compare the two screens.
- Physical webcam/hand tracking, dwell accuracy and camera permission on the two intended devices need an actual hand and those devices. They were not claimed as hardware-tested.
- The two browser tabs are a real end-to-end browser/network exercise, not a test across two physical computers or university Wi-Fi. LAN firewall and network isolation need local confirmation.
- The page contains responsive CSS; no physical mobile-device test was performed.
- Acts II and III are intentionally future work. The first-act ending is a stopping point, not a completed second-act transition.

## Implementation choices to discuss

The working title, short-sentence palette, 1.5-second dwell, abstraction prompt, symmetric filtering and minimum two messages per player are prototype choices. They can be revised without replacing the shared visual asset set.

## Chatroom revision

The illustrated player page was replaced with a standard chatroom after Jiaming clarified the intended experience. The sidebar, message history, always-visible textarea, send action, searching state and end-chat state were reviewed. Eight tests pass, including real stranger matching that excludes invite-code rooms. Two browser tabs were paired through the find button and exchanged freely typed messages in both directions in the labelled rehearsal mode. The separately hosted interface preview uses sample messages and does not offer live stranger matching. The retained illustration assets remain available but are not displayed in this interface.
