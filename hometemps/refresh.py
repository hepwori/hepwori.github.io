#!/usr/bin/env python3
"""Fetch latest HA data and append new points to data.json."""

import sqlite3, json, datetime, subprocess, os, sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
RAW = Path.home() / 'Documents/projects/hometemps'
DB = RAW / 'ha_v2.db'
DATA = HERE / 'data.json'

HA_HOST = 'root@homeassistant.local'
HA_DB = '/homeassistant/home-assistant_v2.db'

GROUPS = {
    'basement':   ['sensor.h5100_4d6f_temperature'],
    'main_floor': ['sensor.h5100_0b48_temperature', 'sensor.h5100_0b5c_temperature',
                   'sensor.aranet4_13b3a_temperature', 'sensor.aqara_temp_humidity_sensor_temperature'],
    'upstairs':   ['sensor.h5100_2c82_temperature', 'sensor.ibs_th2_p01b_016d_temperature',
                   'sensor.h5100_2c1a_temperature', 'sensor.h5100_5e1a_temperature',
                   'sensor.h5100_6c5d_temperature', 'sensor.kids_bathroom_thermometer_temperature'],
    'outdoor':    ['sensor.h5100_624b_temperature', 'sensor.indoor_outdoor_meter_3798_temperature'],
}

def fetch_db():
    print(f'fetching DB from {HA_HOST}...')
    for suffix in ['', '-wal', '-shm']:
        r = subprocess.run(['scp', f'{HA_HOST}:{HA_DB}{suffix}', str(RAW / f'ha_v2.db{suffix}')], capture_output=True)
        if r.returncode != 0 and suffix == '':
            print('scp failed:', r.stderr.decode(), file=sys.stderr)
            sys.exit(1)
    print(f'  → {DB.stat().st_size // 1024 // 1024}MB')

def load_existing():
    if not DATA.exists():
        return [], []
    d = json.loads(DATA.read_text())
    return d.get('data', []), d.get('windows', [])

def query_temps(conn, since_ts_ms):
    # since_ts_ms is ms (Chart.js format); convert to seconds for DB query
    # go back 2h to catch any bucket boundary edge cases
    since_s = max(0, since_ts_ms / 1000 - 7200) if since_ts_ms else 0

    all_entities = [e for v in GROUPS.values() for e in v]
    ph = ','.join('?' * len(all_entities))
    meta = conn.execute(f'SELECT metadata_id, entity_id FROM states_meta WHERE entity_id IN ({ph})', all_entities).fetchall()
    id_to_entity = {r[0]: r[1] for r in meta}
    entity_to_group = {e: g for g, es in GROUPS.items() for e in es}
    meta_ids = list(id_to_entity.keys())
    ph2 = ','.join('?' * len(meta_ids))

    rows = conn.execute(
        f"SELECT last_updated_ts, metadata_id, state FROM states "
        f"WHERE metadata_id IN ({ph2}) AND last_updated_ts >= ? "
        f"AND state NOT IN ('unavailable','unknown','') ORDER BY last_updated_ts",
        meta_ids + [since_s]
    ).fetchall()

    buckets = defaultdict(lambda: defaultdict(list))
    for ts, mid, state in rows:
        try: val = float(state)
        except: continue
        group = entity_to_group.get(id_to_entity.get(mid))
        if not group: continue
        hour = int(ts // 3600) * 3600
        buckets[hour][group].append(val)

    new_points = []
    for hour in sorted(buckets):
        entry = {'ts': hour * 1000}
        for g in GROUPS:
            vals = buckets[hour].get(g, [])
            entry[g] = round(sum(vals) / len(vals), 2) if vals else None
        new_points.append(entry)
    return new_points

def query_ac_windows(conn, since_ts_ms):
    since_s = max(0, since_ts_ms / 1000 - 86400 * 2) if since_ts_ms else 0  # 2-day buffer
    mid = conn.execute("SELECT metadata_id FROM states_meta WHERE entity_id='climate.downstairs'").fetchone()
    if not mid:
        return []
    mid = mid[0]
    rows = conn.execute(
        'SELECT s.last_updated_ts, sa.shared_attrs FROM states s '
        'JOIN state_attributes sa ON s.attributes_id=sa.attributes_id '
        'WHERE s.metadata_id=? AND s.last_updated_ts>=? ORDER BY s.last_updated_ts',
        [mid, since_s]
    ).fetchall()

    windows = []
    current_start = None
    for ts, attrs in rows:
        try: action = json.loads(attrs).get('hvac_action')
        except: continue
        if action == 'cooling' and current_start is None:
            current_start = ts
        elif action != 'cooling' and current_start is not None:
            windows.append({'start': current_start * 1000, 'end': ts * 1000})
            current_start = None
    if current_start is not None:
        windows.append({'start': current_start * 1000, 'end': rows[-1][0] * 1000})
    return windows

def merge_data(existing, new_points):
    existing_ts = {d['ts'] for d in existing}
    added = [p for p in new_points if p['ts'] not in existing_ts]
    merged = sorted(existing + added, key=lambda d: d['ts'])
    return merged, len(added)

def merge_windows(existing, new_windows, since_ts_ms):
    # discard existing windows that start after the overlap boundary, replace with fresh data
    cutoff = since_ts_ms or 0
    kept = [w for w in existing if w['end'] < cutoff]
    merged = sorted(kept + new_windows, key=lambda w: w['start'])
    # deduplicate near-identical windows
    deduped = []
    for w in merged:
        if deduped and abs(w['start'] - deduped[-1]['start']) < 60000:
            deduped[-1]['end'] = max(deduped[-1]['end'], w['end'])
        else:
            deduped.append(w)
    return deduped

def main():
    fetch_db()
    conn = sqlite3.connect(str(DB))

    existing_data, existing_windows = load_existing()
    last_ts = existing_data[-1]['ts'] if existing_data else None

    conn.execute('PRAGMA wal_checkpoint(FULL)')

    print(f'existing data: {len(existing_data)} hourly points, last={datetime.datetime.utcfromtimestamp(last_ts/1000).strftime("%Y-%m-%d %H:%M") if last_ts else "none"}')

    new_points = query_temps(conn, last_ts)
    merged_data, added = merge_data(existing_data, new_points)

    new_windows = query_ac_windows(conn, last_ts)
    merged_windows = merge_windows(existing_windows, new_windows, last_ts)

    DATA.write_text(json.dumps({'data': merged_data, 'windows': merged_windows}))

    print(f'added {added} new hourly points ({len(merged_data)} total)')
    print(f'AC windows: {len(merged_windows)} total')
    first_ts = merged_data[0]['ts']
    last_ts2 = merged_data[-1]['ts']
    print(f'range: {datetime.datetime.utcfromtimestamp(first_ts/1000).strftime("%b %d")} – {datetime.datetime.utcfromtimestamp(last_ts2/1000).strftime("%b %d")}')
    conn.close()

if __name__ == '__main__':
    main()
