# OBSERVER

A complete browser game built with Vite, vanilla JavaScript, and Three.js.

**Genre:** First-person puzzle platformer  
**Core rule:** Reality only exists when observed.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, click **New Game**, then click the canvas to lock the pointer.

## Controls

- `WASD`: Move
- `Mouse`: Look
- `Shift`: Sprint
- `Space`: Jump
- `R`: Reset current level
- `Esc`: Pause

## Features

- Eight procedural levels built around observation puzzles
- Reusable observation manager using camera frustum checks and raycasting
- ObservationWall, ObservationPlatform, ObservationDoor, ObservationEnemy, ObservationProjectile, ObservationMover, and observed room behavior
- First-person movement with PointerLockControls, sprint, jump, air control, collision, checkpoints, and localStorage progress
- Procedural enemies that only chase and attack while observed
- Projectiles and moving platforms that only behave while observed
- Minimalist sci-fi art direction using only Three.js primitives
- Custom dissolve/materialization shader materials
- Procedural Web Audio hums, materialization, danger, checkpoint, and dissolve cues
- Main menu, pause menu, level select, settings, HUD, and victory screen

No external models, Blender files, art assets, or audio files are required.
# ImpalingKitten.github.io
