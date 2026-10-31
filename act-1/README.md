# Between Us · Complete Act I test build

A complete local test build for Jiaming and Sam's two-player game poem. The existing Backup 1 remains unchanged until Jiaming has tested and accepted this version.

## Run

On Windows with Node.js 24 LTS installed, double-click **START_ACT1.cmd**. It installs dependencies on first launch and opens **http://localhost:3000**. Alternatively:

```text
npm ci
npm start
```

The setup page creates a test session with separate **Player 1**, **Player 2** and **side-by-side** links. Do not open a player's seat more than once in the same room. To test with another computer, use the LAN player links shown on the setup page. Only the host computer runs Node and Ollama.

## Modes

- **Ollama**: x is interpreted by the chosen installed model and y reaches the other player.
- **Connection test**: x reaches the other person unchanged. No language model is used.
- **Rehearsal**: preset phrases use fixed interpretations; free text passes through. No language model is used.

The setup page checks Ollama availability, lists installed models and can make a real single-message probe. Open Ollama and run **SETUP_OLLAMA.cmd**, or `ollama pull qwen2.5:1.5b`, to prepare the default model. Each room retains the mode/model chosen when it was created.

Ollama mediates a real person's words. It does not automatically invent the other player's response. Both player views are live, independently connected clients and contain no sample transcript.

## Act I

Player 1 sees a familiar conversation; Player 2 sees a companion identity cue. Each sees their own original words and the other person's delivered words. Both contribute at least two messages and choose **Continue together** to finish Act I. The original/delivered comparison is available only to the test setup through its host token; it is not exposed in the player view. The subsequent acts are future work.

Messages, roles, reconnection, typing indicators, in-flight feedback and delivery states are handled by the Node/Socket.IO server. All sessions stay in RAM. Restarting the server clears them. The old illustration source assets remain unchanged.

## Files and checks

Read **先读我.md** for step-by-step Chinese instructions, and **SOURCES.md** for primary references and the explanation for Boyd. **VERIFICATION.md** states the completed tests and their limits.

```text
npm run check
npm test
npm run doctor
```

The Windows launchers are supplied for the user's computer; their behavior has not been executed on Windows in this Linux executor. Camera hardware and two physical devices on the university network still require local verification.
