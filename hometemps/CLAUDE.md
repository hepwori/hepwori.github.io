# hometemps

Interactive chart of whole-house temperature history pulled from Home Assistant, with A/C runtime overlaid as shaded bands.

## project structure

```
hometemps/          ← this dir, lives in hepwori.github.io (public)
├── CLAUDE.md
├── README.md
├── refresh.py      ← fetch + extract script; run to update data
├── index.html      ← chart UI (Chart.js, zoom/pan, AC bands)
└── data.json       ← extracted data, committed and public

~/Documents/projects/hometemps/   ← raw data, NOT in the repo
├── ha_v2.db        ← local copy of HA sqlite DB (~500MB)
├── ha_v2.db-wal
└── ha_v2.db-shm
```

## to update

```bash
cd ~/Documents/projects/hepwori.github.io/hometemps
python3 refresh.py
```

fetches DB from `root@homeassistant.local` via scp (key auth), appends new hourly buckets to `data.json`. safe to run repeatedly — deduplicates on timestamp.

## infrastructure

- HA on Raspberry Pi 5 at `homeassistant.local:8123` / `10.0.0.73`
- DB at `/homeassistant/home-assistant_v2.db` (WAL mode — must copy `-wal` and `-shm` too)
- HA configured with `recorder: purge_keep_days: 30`

## sensors

| series | entities averaged |
|--------|-------------------|
| basement | h5100_4d6f |
| main floor | h5100_0b48, h5100_0b5c, aranet4_13b3a, aqara_temp_humidity_sensor |
| upstairs | h5100_2c82, ibs_th2_p01b_016d, h5100_2c1a, h5100_5e1a, h5100_6c5d, kids_bathroom_thermometer |
| outdoor | h5100_624b, indoor_outdoor_meter_3798 |

A/C windows from `climate.downstairs` → `hvac_action == "cooling"`.

## key finding (Jun 2026)

basement cools noticeably during AC runs; upstairs is unresponsive. suspected disconnected/blocked ductwork — single-zone system with unit in basement, thermostat on main floor.
