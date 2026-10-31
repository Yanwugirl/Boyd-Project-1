# Act I · sources and adaptation record

Checked 31 October 2026. The domestic first act follows **Project1_AI_Relationships_Bilingual_Notes.md** and Boyd's later hand-drawn input/output diagram. This file documents references for the implementation; it is not a claim that the artwork is provided by a tutorial.

| Primary source / code website | What was studied | Use in this build | What was added |
|---|---|---|---|
| [p5.js: Shape Primitives](https://p5js.org/examples/Shapes-And-Color-Shape-Primitives/) | `rect`, `ellipse`, `line`, polygons and drawing state | `public/scene.js`, `drawVector()` | Original room, seated figure, detachable robot shell and objects defined in `vector-assets.json`. The composition was drawn for this project; no finished room illustration was copied. |
| [p5.js: Linear Interpolation](https://p5js.org/examples/Calculating-Values-Interpolate/) | Updating a current value partway towards a target using `lerp` | Light intensity and remote pointer motion in `scene.js` | Network data becomes a subtle moving thread rather than a raw tracked-body display. The numerical smoothing principle is adapted; the example's complete sketch is not embedded. |
| [p5.js: noise() reference](https://p5js.org/reference/p5/noise/) | Smoothly varying values and a repeatable seed | Quiet dust motion and consistent scene texture | A fixed seed preserves continuity across different devices and later acts. |
| [p5.js: Speak With Your Hands](https://p5js.org/tutorials/speak-with-your-hands/) by Akanksha Vyas, Portia Morrell and Liyah Coleman | `ml5.handPose`, keypoints and continuous detection | `public/gesture.js` | The index fingertip selects short sentences through dwell; visibility checks pause lost-hand input. A move-away requirement avoids repeated sends. |
| [ml5 official handPose-keypoints sketch](https://editor.p5js.org/ml5/sketches/QGH3dwJ1A) | Live webcam input and the 21 hand landmarks | HandPose API reference alongside the p5 tutorial | Hand coordinates are mirrored once and mapped to the screen. Raw video is never drawn in the artwork or sent over the network. |
| [Ollama: Generate a chat message](https://docs.ollama.com/api/chat) | `/api/chat`, `messages`, `stream: false`, structured JSON and `message.content` | `lib/interpreter.cjs` | An original prompt interprets `x`; validated `y` and a tone enter the room. Errors are displayed instead of silently substituting an answer. |
| [Ollama: Quickstart](https://docs.ollama.com/quickstart) and [Qwen2.5 1.5B](https://ollama.com/library/qwen2.5:1.5b) | Running a model locally and sending requests from Node | Windows start instructions and default model | Model selection stays configurable. The model runs on the Node host, not separately in each browser. |
| [Socket.IO: official introduction](https://socket.io/docs/v4/tutorial/introduction) | Server events and real-time communication | `server.cjs`, browser `app.js` | Two-seat rooms, authoritative roles, private message views, reconnect handling and a two-person ending. |

The Shape Primitives and Linear Interpolation example pages credit their contributors and use **CC BY-NC-SA 4.0**. This project studies their basic functions and numerical approach and supplies its own scene code; complete original example sketches are not redistributed. The p5.js **library** is separate and is included unmodified with its LGPL 2.1 licence in `public/vendor/p5/`. ml5 is loaded from a pinned CDN; its own licence applies. Express and Socket.IO retain their package licences.

## Why these choices support the theme

The room is deliberately ordinary: intimacy happens around a familiar screen, not only in a futuristic setting. Both players share the same asset set but read different identity cues. Hand input makes selecting a sentence a bodily action. The other person's actual choice is necessary: Ollama only changes that choice on its journey. Storing `x` and `y` separately gives Act II a way to expose the gap later.

## Short explanation for Boyd

I started with p5's Shape Primitives and Linear Interpolation examples, then used those techniques to draw a quiet room and a removable robot shell. I used the official p5/ml5 hand tutorial to turn a fingertip into a cursor that can choose a sentence. Following our diagram, the server stores a player's input as x, asks local Ollama for an abstract interpretation, stores the result as y, and sends y to the other player through Socket.IO. The original and delivered messages remain separate so the second act can reveal how the interface shaped the conversation. The two people still supply the words; the model does not replace either participant.

## Chatroom interface revision

After Jiaming clarified the intended experience, the player-facing page was rebuilt as a conventional one-to-one chatroom in original HTML/CSS. The current visual interface does not display the earlier p5 domestic scene. The earlier p5 source references and unchanged vector asset set remain available for later narrative decisions. Socket.IO now also pairs two waiting visitors, and an always-visible textarea supports freely typed conversation. The independently hosted interface preview is explicitly a sample layout, not a live chat service.

## Complete Act I test build

The full local build adds explicit player entry routes, a side-by-side page, connection/model setup, and a host-only message inspection record. The default model is [Qwen2.5 1.5B](https://ollama.com/library/qwen2.5:1.5b); other installed models remain selectable. Setup uses the official [model list endpoint](https://docs.ollama.com/api/tags), and message interpretation uses [the chat endpoint](https://docs.ollama.com/api/chat). The actual local inference results are supplied with the test build. The player UI uses HTML/CSS with the existing shared chat layout; the earlier p5 vector assets are unchanged and remain available for later acts.
