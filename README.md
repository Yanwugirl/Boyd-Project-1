# Between Us complete three-act experience

A two-person networked game poem by Jiaming and Sam. The complete local build moves through an interpreted conversation, cooperative recovery of the original signal, and a final conversation where the participants' own words arrive unchanged.

## Start

On Windows, extract the package to a new folder and close any previous server using port 3000. Double-click **START_PROJECT1.cmd** with Node.js 24 installed. The first run installs the pinned dependencies. Keep the command window open. Alternatively run `npm ci` followed by `npm start`.

In the launcher, choose the room's Act I mode and an installed Ollama model under Connection settings. The host computer runs Node and Ollama. Other devices open their player invitation in a browser. LAN invitations use the current detected address, and the room code joins an existing free place. Each room has two seats.

## Three acts

**I A conversation.** Both people supply their own words. Each person sees their own original messages and their partner's delivered messages. The selected Ollama model interprets messages in Ollama mode. Direct and Prepared modes remain available. After two messages each, both choose Continue together.

**II Between the words.** The room reveals the real original/delivered pairs. Player 2 holds a listening circle and guides Player 1 through the right passage after an original-signal request and consent. The roles swap for the second passage. Both people recover their key fragment, bring them together at the doorway, and independently choose to continue. The symbol echo is an explicit deterministic game rule. See ACT2_设计与试玩说明.md for the controls.

**III The words are yours.** Player 1 offers the shared key. Player 2 can accept or ask for more time, and the shell opens only on their acceptance. The scene warms into an unrestricted text conversation. Chinese, English, emoji, spacing, and line breaks are delivered exactly as entered. The final conversation uses a direct server path independent of the Act I model. Both can type and send concurrently. There is no required message count or countdown for this conversation. Either person may propose closing, and both must confirm. Sending another message cancels a pending closing request. The ending shows their actual final words and allows reading the conversation again.

## Continuity and limits

Both scene transitions use one room, the same identities, retained transcript, and a two-client loading barrier. Refresh restores the current act while the server remains running. Act III also keeps a local draft and a pending message ID to avoid duplicate messages after retrying. Disconnect pauses paired actions and cancels an unfinished closing request.

Each final-act message supports up to 2000 JavaScript string characters. The room retains the latest 500 final-act messages without imposing an ending. Rooms and delivered messages are in memory and clear when the host server restarts. A local draft alone cannot restore a closed server room.

Optional hand input uses the existing pinned ml5 adapter. Camera access needs localhost or HTTPS. The floor also supports pointer, touch, arrow keys, and WASD. Physical camera and campus-network checks still need the intended devices.

Read **先读我.md** to start, **ACT3_交流与完整流程.md** for the final-act interaction, **SCENE_INTEGRATION.md** for code navigation, and **VERIFICATION.md** for evidence and practical limits.

```text
npm run check
npm test
```
