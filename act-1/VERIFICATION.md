# Complete Act I · Verification

Checked 31 October 2026. This is a test build, not a replacement of Backup 1.

## Completed

- Ten automated tests cover real Socket.IO connections, original/transformed message separation, room isolation, explicit Player 1/Player 2 seats even when Player 2 enters first, reconnection, invalid data, model failures, setup/session APIs, protected test inspection and the shared ending.
- JavaScript syntax checks pass for the server, interpreter, chat clients, setup page and retained p5/hand code.
- In the cloud browser, two separate tabs opened Player 2 and Player 1, showed their different identity cues, exchanged freely typed text and quick phrases in the explicitly labelled direct-connection mode, and completed Act I after both confirmed Continue together. The setup page displayed the actual message record.
- Actual local Ollama inference was also tested with a real downloaded model and the Node application, using two WebSocket clients. This includes an HTTP model probe, four messages crossing both ways and the shared Act I ending. Exact model/version, timings and outputs are recorded in TEST_RESULTS_REAL_OLLAMA.json. These results do not use a mock model.
- Earlier vector source assets were checked against ASSET_MANIFEST.json and retained unchanged.

## Practical limits

- These tests took place in the executor, not on Jiaming's Windows computer or on two physical devices on university Wi-Fi. The Windows command files are supplied and reviewed but have not been executed on Windows here.
- The actual model test uses the model named in TEST_RESULTS_REAL_OLLAMA.json. Other models can be selected on the setup page; their wording, speed and interpretation quality can differ. A small model can change the meaning more than intended. The x/y comparison makes this visible for review. This is not a guarantee of faithful paraphrasing for every message.
- The browser run used the direct-connection mode. The real Ollama run used the same server/application with two programmatic WebSocket clients, not the two browser tabs.
- Physical camera tracking and hand-dwell accuracy require local hardware verification. Ordinary text input works over local HTTP; webcam use requires localhost or HTTPS.
- Rooms and messages are held in memory. Restarting the server removes them.
- Acts II and III are not part of this Act I build. The ending stops at the threshold of the next act.

## Backup status

Backup 1 and the previous published interface preview are unchanged. Jiaming will test this complete build before deciding whether to replace Backup 1.
# Continue notification update (v2)

The 31 October user test on Windows confirmed a real local gemma3:1b probe, four messages delivered in Ollama mode, and the shared Act I ending. The supplied audit shows substantial semantic drift and a repeated interpretation for different inputs. Output quality remains a separate item for review.

This update changes only the player interface: a persistent, high-contrast continue request with a confirmation action; the initiator's cancellation action; a recipient tab-title reminder; and completed labels in the header, sidebar, footer and tab title. The server and model prompt are unchanged.

Validated with the existing syntax checks and all 10 automated tests. Browser QA used a direct-mode room with two real browser clients to isolate the interface behavior: each player contributed two messages; Player 1 initiated; both views showed their respective states; cancellation removed both notices; Player 2 initiated; a reload preserved the partner's request; confirmation completed both views and cleared the request. No new model inference is claimed for this interface-only check. Physical two-computer networking remains untested here.

# LAN player links update

The user confirmed in v1 that a Windows computer and phone could join through the same LAN after creating a fresh room. Testing with Sam's second computer at university is still pending.

The v2 setup now uses the detected LAN origin for the main player buttons, visible player URLs, copy actions and split view when opened from localhost. When opened from an existing LAN or hosted address it preserves that origin. Hostnames are detected at runtime, so a different network does not keep a hardcoded 10.27.137.111 address.

Validation: syntax checks and the existing 10 automated tests pass. The actual setup JavaScript was exercised in an isolated DOM fixture matching the real setup HTML: room creation, both main links, both visible links, both copy actions and the split link all used http://10.27.137.111:3000 with the generated room ID. Address selection was also checked for loopback, changed LAN address, existing LAN origin, hosted origin and absent LAN detection. This is link-generation verification, not a new claim of physical network access from this environment.

