# flock

web-based murmuration simulator. vanilla js, no build step, no dependencies.

live at [hepwori.github.io/flock](https://hepwori.github.io/flock/)

## run locally

```sh
cd ~/projects/hepwori.github.io
python3 -m http.server 3000
# open http://localhost:3000/flock/
```

## controls

| control | action |
|---|---|
| sliders (right panel) | tune flocking behavior live |
| click canvas | predator scare — boids scatter from cursor |
| `h` | toggle control panel |
| scatter button | randomize all velocities |
| reset button | respawn all boids |

## the algorithm

classic [craig reynolds boids](https://www.red3d.com/cwr/boids/) (1986), three rules applied per tick:

1. **separation** — avoid crowding neighbors within avoid-dist
2. **alignment** — match velocity of neighbors within visual range
3. **cohesion** — steer toward center of mass of neighbors

good starting point for murmuration-like behavior: trail ~0.7, visual range ~50, separation ~3.
