# Project 1 v6 — focused partner-notice patch

4 November 2026. Only the two Act II client assets were changed: act2.mjs and act2.css. A persistent high-contrast panel now tells the other player when their partner chooses Step into the space or is ready to exchange roles. The panel includes the matching confirmation action; the duplicate action in the scrollable content is hidden while the request is visible. The panel clears after both confirm, and the existing scene and server rules are retained.

Focused verification: act2.mjs passes Node syntax checking. Two actual browser views entered Act II through the normal launcher and Act I. The receiving view showed the entry notice, retained it after refresh, and entered the room using its button. After the first fragment was collected through normal play, one player requested the role exchange; the other view displayed the persistent exchange notice. Confirming that notice advanced both clients to Gate 2 and removed the notice. Both notice layouts were visually inspected. The prior complete-flow checks below describe v5; they were not rerun for this small UI patch.

---

# Project 1 v5 verification

Checked 4 November 2026. This package contains the complete three-act local experience.

## Automated checks

All 16 automated tests pass. JavaScript syntax checks cover the server and browser modules. The retained checks exercise Act I, the interpreter boundary, private clues, both Act II puzzle rounds, role exchange, movement validation, reconnect, joined-key prerequisites, mutual consent, and the shared scene-loading barrier.

New Act III checks exercise role-specific key invitation, deferral and acceptance; shared opening time; exact original text; empty and oversized message rejection; client-message deduplication; recovery after reconnect; cancelled closing votes; and mutual completion of all three acts. A real Socket.IO integration test completes the journey through Act III with two clients. It counts calls to its fixture interpreter and verifies that Act III makes no additional interpreter calls. The rolling history check verifies that the latest 500 messages remain available without ending the conversation automatically.

## Browser playthrough

Two actual browser tabs completed the normal launcher-to-ending path in Prepared mode, without skipping scenes or changing application state through developer tools.

1. Both players joined the same room, exchanged two messages each in Act I, and separately agreed to continue.
2. Both compared the original and delivered words in Act II. Each took a turn guiding and crossing, requested and shared the original symbol, and collected a key fragment. Both reached the final circles, held to join the key, and agreed to enter Act III.
3. Both tabs were refreshed at the sealed Act III doorway and recovered the same key and identities. Player 2 requested the key. Player 1 offered it. Player 2 chose to take more time; Player 1 received that notice. A second invitation was accepted and both clients opened the shell together.
4. A Chinese/English message containing a newline, emoji, and leading/trailing spaces was sent through the visible composer. The recipient's rendered message text matched the original string exactly. The second player replied with a multiline message using Enter. Typing status appeared at the other end.
5. An unsent draft was entered, the tab was refreshed, and the exact draft and both delivered messages were recovered. A third message was sent normally. The warm conversation layout and opened shell were visually inspected.
6. One player requested to close, the other received a persistent notice, and cancelling the request removed it. Both then agreed to close. Both clients displayed the completed ending and actual last message from each player. The header displayed "Completed together". Reading the conversation showed the delivered messages with a read-only composer state. Returning to the ending and refreshing the other completed tab retained completion.

Screenshots of the actual conversation and completed ending were inspected. The final browser error-log check reported no application errors.

## Model, input, and network scope

The browser playthrough used Prepared mode, whose Act I transformations are scripted. The Act II symbol echo is a deterministic game rule. This update makes no claim of a fresh real Ollama inference run. The existing model adapter and prompt remain unchanged; historical inference evidence is retained in TEST_RESULTS_REAL_OLLAMA.json. Act III sends the player's original text directly and does not invoke Ollama.

Pointer input and keyboard text entry were verified in the cloud browser. Optional hand input retains the existing pinned ml5 integration. Physical camera tracking, input-method behaviour on individual devices, touch hardware, and two physical campus computers still need local verification. Camera access requires localhost or HTTPS. Ordinary LAN HTTP supports the pointer/keyboard path, subject to the host firewall and network isolation rules.

## Persistence and package integrity

Rooms, scene progress and the latest 500 Act III messages are held in server process memory. Stopping or restarting the host server clears them. Browser session storage preserves this tab's unsent Act III draft and pending send identifier while available. Refresh/reconnect can restore progress while the room remains alive; it is not persistent storage across server restarts.

Disconnect pauses shared interaction and cancels pending consent while retaining completed progress. Shared timestamps coordinate entry and opening without promising exact frame synchronization across networks. Both players must independently agree to end; there is no conversation timer.

All 16 entries in ASSET_MANIFEST.json were checked against their recorded hashes and byte counts. The bundled p5 file retains its previous bytes. No new external artwork or runtime dependency was added. BUILD_MANIFEST.json lists the packaged source files and their SHA-256 hashes. The ZIP is checked for corruption, expected entry points, and exclusion of installed dependencies and local environment files.

This is a complete local review build for Jiaming and Sam. Public hosting and GitHub publication are separate actions. The existing Backup 1 is unchanged.
