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
