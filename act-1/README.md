# Between Us · Act I

A two-person networked game poem by Jiaming and Sam. This build implements the domestic conversation from **Project1_AI_Relationships_Bilingual_Notes.md** and the later discussion with Boyd: `x = player input`, `y = an abstract interpretation from local Ollama`, then deliver `y` to the other player.

The first connection receives the human role; the second receives the robot role. Each sits in a separate home. They see different identity cues and the same visual world. Their actual choices travel through the interface. The first act does not reveal the original/transformed comparison; the server retains it for the later act.

## Quick start on Windows

Install Node.js 22 or later. Open this **act-1** folder in VS Code, choose **Terminal → New Terminal**, then run:

```powershell
npm ci
npm run demo
```

Open **http://localhost:3000**. Choose a room name such as `our-window`. Open the same URL in another browser/window. The **Open a second player** link under **Room & rehearsal details** creates a fresh seat in a new tab. Rehearsal uses clearly labelled fixed dialogue; it does not use a language model.

Stop the server with **Ctrl+C**. To use real local inference, install and open [Ollama](https://ollama.com/download), then run:

```powershell
ollama pull llama3.2:1b
npm start
```

`npm start` defaults to real Ollama. No API key is used. Node communicates with `http://127.0.0.1:11434` on **the computer running the server**. Do not open the HTML file by double-clicking or with VS Code Live Server; those methods do not start Socket.IO.

For another installed model or a different port, copy `.env.example` to `.env`, then edit `OLLAMA_MODEL` or `PORT`. The model name must match `ollama list`. Small models can produce weak or inconsistent metaphors; review the outputs before a classroom showing. Prompts are in `prompts/abstract.txt`.

## Two devices

On the server computer, find the IPv4 address using `ipconfig`. With both devices on a network that permits direct device connections, the second device opens **http://YOUR-IP:3000/?room=our-window**. Allow Node through the private-network firewall if Windows asks. Run Ollama on the server computer only; do not expose port 11434.

University/guest Wi-Fi may isolate devices. A phone hotspot or a private router is a useful alternative. Internet-wide play needs an accessible HTTPS Node server and a deliberate route to the local model; this build does not claim that a cloud server can reach your PC's `localhost`.

Camera access needs **localhost or HTTPS**. A plain LAN HTTP address supports mouse/typed input, but generally cannot request a webcam. A second laptop can use the mouse for this prototype. Final gesture use on two devices needs an HTTPS address. The hand model downloads via the pinned ml5 CDN when first enabled; camera images stay on the browser and are not sent through Socket.IO or to Ollama.

## Play

1. Both players enter the same room. Each chooses one of four phrases; **more words** cycles through twelve phrases.
2. **Use my hand** turns on local hand tracking. Point with the index fingertip and dwell on a phrase for 1.5 seconds. Move away to rearm. Losing the hand pauses selection. A mouse can choose the same phrases. **write my own** is an optional prototype input.
3. Your own screen shows the line you chose (`x`). The other screen receives the interpreted line (`y`). Both participants are real players. The language model does not generate an autonomous partner.
4. After at least two messages each, both may choose **Leave this room together**. This closes Act I at the threshold of Act II. Acts II and III are not implemented here.

No one can send while the partner is disconnected. Refreshing restores the same tab's seat and transcript. New visitors cannot take an active seat. Disconnected seats have a ten-minute grace period; a replacement after that starts a fresh transcript. Empty rooms expire after thirty minutes. All conversation data is held in RAM; restarting the server clears it. There is no public transcript endpoint and no disk log of x/y.

## Shared assets and source

- `public/assets/`: shared colours, dimensions, dialogue, primitive definitions and ten exported SVGs.
- `public/scene.js`: p5 rendering of the same vector data; reuse this in later acts.
- `public/assets.html`: asset gallery with source links.
- `SOURCES.md`: exact references, functions used, changes, and an English explanation for Boyd.
- `设计说明与运行指南.md`: Chinese instructions and boundaries between agreed direction and implementation choices.
- `ASSET_REUSE.md`: asset reuse contract for Acts II and III.
- `tools/build-assets.py`: reproduces the JSON and SVGs from the same original coordinates.
- `server.cjs`: room roles, messages, presence and act state.
- `lib/interpreter.cjs`: the `x → y` Ollama adapter plus the explicit rehearsal option.

## Checks

```powershell
npm run check
npm test
```

Automated tests use real Socket.IO clients against the Node server. Ollama API tests use a local HTTP fixture and do not constitute a real model inference test. Hardware hand tracking and the model installed on Jiaming's PC require local confirmation. See `VERIFICATION.md` for the completed checks and remaining limits.

Visual previews: **http://localhost:3000/?preview=human** and **?preview=robot**. These show clearly labelled sample dialogue without a partner or model connection.
