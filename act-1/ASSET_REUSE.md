# Shared asset set · act1-2026-10-31-v1

Keep the entire `public/assets` folder and `public/scene.js` when extending this work. The SVGs and p5 drawings come from the same primitive coordinates; they are not independent look-alike illustrations.

| Stable file / asset ID | Role | Later use |
|---|---|---|
| `design-tokens.json` | Palette, 1200 × 760 stage, layout coordinates, random seed | Preserve colours, proportions and character scale. |
| `vector-assets.json` | Canonical vector primitives | `RoomArt.drawVector` draws these with p5. |
| `svg/room.svg` | Empty domestic room | Keep as Act I reference; change the setting for Act II without replacing characters. |
| `svg/person.svg` | Person beneath the costume | The same person remains present when the shell is removed in Act III. |
| `svg/robot-shell.svg` | Separate transparent costume | Overlay at the exact person position and scale. Remove this layer; do not redraw a new character. |
| `svg/chair.svg` | Seated pose support | Reuse for both domestic rooms. |
| `svg/desk.svg` | Foreground desk | Same geometry on both devices. |
| `svg/phone.svg`, `svg/lamp.svg`, `svg/mug.svg`, `svg/plant.svg` | Common objects | Reuse as motifs or later puzzle references. |
| `svg/door.svg` | Reserved transition object | Available for later acts; no second-act puzzle is implied by its inclusion. |
| `dialogue.json` | Twelve selectable lines with permanent IDs | Keep IDs stable; later acts can reveal original choices. |

## Layers and coordinates

`person` and `robot-shell` both use a **220 × 355** coordinate space. Act I draws both at `(445, 265)` with a small shared breathing offset. The shell's holes are transparent. Set `role = human` or stop drawing the `robot-shell` layer to show the same underlying person.

The order is `room → light → chair → person → optional shell → desk → lamp / phone / mug / plant → presence thread`. Keeping foreground and background apart allows the future transition without replacing the figures.

## File integrity

`ASSET_MANIFEST.json` lists SHA-256 hashes of the supplied canonical files and SVGs. Retain this version for the course handoff. If an intentional revision becomes necessary, give the new set a new version and keep this version separately. Do not re-generate or substitute new imagery between acts.

To reproduce this exact source set from code:

```text
python tools/build-assets.py
```

The ten SVGs are editable in Illustrator and can be placed into Photoshop. They are vector assets, not a PSD. The earlier moodboard remains a separate reference file.
