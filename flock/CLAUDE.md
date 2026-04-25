# flock — context for claude

## what this is

web-based murmuration / flocking simulator, part of hepwori.github.io. single-file vanilla JS + Canvas 2D, no dependencies, no build step.

## current state

- `index.html` — complete working boids simulator (reynolds 1986: separation, alignment, cohesion)
- `.claude/launch.json` — dev server config (python3 http.server on port 3000, serving repo root)

## dev server

```
cd ~/projects/hepwori.github.io
python3 -m http.server 3000
# open http://localhost:3000/flock/
```

or use `preview_start` with the launch.json already at `.claude/launch.json`.

## architecture

single `index.html`. all logic inline:
- `Boid` class: position/velocity/acceleration, `flock()` computes neighbor forces, `update()` integrates, `draw()` renders as arrow triangle
- `p` object: all tunable params, sliders write directly into it
- trail effect: semi-transparent bg fill each frame (alpha = `1 - p.trail * 0.97`)
- predator: click canvas → scatter nearby boids, 40-frame decay

## parameters (all live-tunable via panel)

| param | effect |
|---|---|
| visual range | neighbor perception radius |
| avoid dist | separation trigger distance |
| separation | push-away force weight |
| alignment | velocity-matching force weight |
| cohesion | center-of-mass attraction weight |
| max speed | velocity clamp |
| max force | steering force clamp per tick |
| trail | 0=instant clear, 1=infinite smear |
| size | boid scale multiplier |

## known performance cliff

O(n²) neighbor search — fine up to ~400 boids on modern hardware. beyond that needs spatial grid (e.g. fixed-cell bucketing by visual range).

## ideas / next directions

- spatial grid for performance (allows 1000+ boids)
- wind / flow field perturbation
- predator entity that moves (not just a click point)
- color by speed or flock membership
- audio reactivity (mic input → turbulence)
- multiple species with inter-species rules
- export / record to gif or video
- p5.js port for easier sketching
