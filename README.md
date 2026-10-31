# Project 1 Networked Presence

Jiaming and Sam's Project 1 workspace. The Week 6 tutorial is kept separate from the proposed AI relationships game poem.

## Week 6 homework

- [Shared Circles source and Windows instructions](week-06/shared-circles/README.md)
- [Creative coding examples](week-06/shared-circles/public/practice/)
- [Reading and inspiration notes](week-06/READING_NOTES.md)
- [Homework status](week-06/STATUS.md)

From VS Code's terminal:

```powershell
cd week-06/shared-circles
npm ci
npm start
```

Then open http://localhost:3000 in two windows. The creative coding lab is at http://localhost:3000/practice/.

The Shared Circles tutorial was supplied by Boyd. The live examples were supplied with the Creative Coding lesson. Adaptations and tests are labelled in the exercise documentation. This repository is a study workspace, not a completed Project 1 game.

## Game poem · Act I

[Between Us · Act I](act-1/README.md) implements the domestic conversation, with two real players, p5 visuals, hand-selected phrases, Socket.IO rooms, and local Ollama interpretation (`x → y`).

- [Chinese setup and design notes](act-1/设计说明与运行指南.md)
- [Code references for classroom discussion](act-1/SOURCES.md)
- [Shared assets for all three acts](act-1/ASSET_REUSE.md)

From the `act-1` directory, run `npm ci`, then `npm run demo` for the labelled rehearsal or `npm start` for real local Ollama. Acts II and III are future work.
