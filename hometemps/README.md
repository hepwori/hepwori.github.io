# hometemps

Whole-house temperature history from Home Assistant sensors, with A/C runtime overlaid.

## update data

```bash
python3 refresh.py
```

Requires SSH access to `homeassistant.local`. Appends new data to `data.json` — existing history is preserved.
