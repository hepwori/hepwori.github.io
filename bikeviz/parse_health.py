#!/usr/bin/env python3
"""
parse_health.py — extract cycling workouts from apple health export
usage: python3 parse_health.py /path/to/export.zip
       python3 parse_health.py /path/to/export.xml   (unpacked export also works)

outputs rides.json and tracks.json in the current directory.
streams the XML iteratively so 2.7GB+ files are no problem.
"""

import sys
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


def parse_date(s):
    if not s:
        return None
    # apple health dates look like "2023-04-15 08:32:11 -0700"
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S %z").isoformat()
    except ValueError:
        return s


def to_miles(value, unit):
    if unit in ("mi", "miles"):
        return value
    if unit in ("km", "kilometers"):
        return value * 0.621371
    return value  # assume miles if unknown


def to_mins(value, unit):
    if unit in ("min",):
        return value
    if unit in ("s", "sec", "seconds"):
        return value / 60
    if unit in ("hr", "hours"):
        return value * 60
    return value


def downsample(points, max_pts):
    """Uniformly subsample a list of points to at most max_pts."""
    if len(points) <= max_pts:
        return points
    step = len(points) / max_pts
    return [points[int(i * step)] for i in range(max_pts)]


def parse_gpx(gpx_path):
    """Parse an Apple Watch GPX file.
    Returns (start_time_iso, elev_gain_ft, track_points) where track_points is
    a list of [lat, lon] pairs (downsampled). Any field may be None/[] on failure.
    """
    try:
        tree = ET.parse(str(gpx_path))
        root = tree.getroot()
        ns = {"g": "http://www.topografix.com/GPX/1/1"}

        # First trackpoint time = workout start (metadata time = export date, not workout)
        start_time = None
        t = root.find(".//g:trkpt/g:time", ns)
        if t is not None and t.text:
            start_time = t.text.strip()

        # Extract all trackpoints as (lat, lon, ele_m, time_str)
        raw_pts = []
        for trkpt in root.findall(".//g:trkpt", ns):
            lat, lon = trkpt.get("lat"), trkpt.get("lon")
            if not lat or not lon:
                continue
            try:
                lat_f, lon_f = float(lat), float(lon)
            except ValueError:
                continue
            ele_el = trkpt.find("g:ele", ns)
            ele_f = None
            if ele_el is not None and ele_el.text:
                try:
                    ele_f = float(ele_el.text)
                except ValueError:
                    pass
            time_el = trkpt.find("g:time", ns)
            time_str = time_el.text.strip() if time_el is not None and time_el.text else None
            raw_pts.append((lat_f, lon_f, ele_f, time_str))

        # ele == 0.0 is an uncalibrated barometer sentinel — exclude from gain calc
        elevs = [p[2] for p in raw_pts if p[2] is not None and p[2] > 0]

        # Elevation gain
        gain_ft = None
        if len(elevs) >= 2:
            gain_m = sum(b - a for a, b in zip(elevs, elevs[1:]) if b - a > 0)
            gain_ft = int(round(gain_m * 3.28084))

        # Compute elapsed time in minutes relative to first trackpoint
        t0 = None
        for p in raw_pts:
            if p[3]:
                try:
                    t0 = datetime.fromisoformat(p[3].replace("Z", "+00:00"))
                    break
                except Exception:
                    pass

        def elapsed_min(time_str):
            if not t0 or not time_str:
                return None
            try:
                t = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                return round((t - t0).total_seconds() / 60, 2)
            except Exception:
                return None

        # Downsample to ≤200 points; store [lat, lon, ele_m, elapsed_min]
        # ele == 0.0 → None so route map colour gradient isn't skewed by uncalibrated points
        track = [
            [round(p[0], 5), round(p[1], 5),
             (round(p[2], 1) if p[2] > 0 else None) if p[2] is not None else None,
             elapsed_min(p[3])]
            for p in downsample(raw_pts, 200)
        ]

        return start_time, gain_ft, track

    except Exception:
        return None, None, []


def match_gpx_to_rides(rides, routes_dir):
    """Parse all GPX files in routes_dir.
    Attaches elev_gain_ft to matching rides and returns a
    {ride_date_str: [[lat,lon],...]} track dict for tracks.json.
    """
    gpx_files = sorted(Path(routes_dir).glob("*.gpx"))
    if not gpx_files:
        return {}
    print(f"  found {len(gpx_files)} GPX files, extracting elevation + tracks...")

    ride_dts = []
    for i, ride in enumerate(rides):
        try:
            ride_dts.append((i, datetime.fromisoformat(ride["date"])))
        except Exception:
            pass

    matched, used = 0, set()
    track_data = {}
    n_gpx = len(gpx_files)

    for gpx_i, gpx_path in enumerate(gpx_files):
        if gpx_i % 100 == 0 and gpx_i > 0:
            print(f"  {gpx_i}/{n_gpx} GPX files processed, {matched} matched...")

        start_str, gain_ft, track = parse_gpx(gpx_path)
        if not start_str:
            continue
        try:
            gpx_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        except Exception:
            continue

        best_i, best_secs = None, 120.0
        for i, ride_dt in ride_dts:
            if i in used:
                continue
            diff = abs((ride_dt - gpx_dt).total_seconds())
            if diff < best_secs:
                best_secs, best_i = diff, i

        if best_i is not None:
            if gain_ft is not None:
                rides[best_i]["elev_gain_ft"] = gain_ft
            if track:
                track_data[rides[best_i]["date"]] = track
            used.add(best_i)
            matched += 1

    print(f"  matched {matched}/{len(gpx_files)} rides (elevation + GPS tracks)")
    return track_data


def main():
    if len(sys.argv) < 2:
        print("usage: python3 parse_health.py export.zip|export.xml")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path.cwd() / "rides.json"

    if not input_path.exists():
        print(f"error: file not found: {input_path}")
        sys.exit(1)

    import time, zipfile, tempfile, shutil

    is_zip = input_path.suffix.lower() == ".zip"
    file_gb = input_path.stat().st_size / 1024**3
    print(f"{'unzipping' if is_zip else 'streaming'} {input_path.name} ({file_gb:.2f} GB)...")

    rides = []
    count = 0
    skipped = 0
    workouts_seen = 0
    records_seen = 0

    _zip = None
    _tmpdir = tempfile.mkdtemp()
    if is_zip:
        _zip = zipfile.ZipFile(input_path)
        names = _zip.namelist()
        xml_name = next((n for n in names if n.endswith("export.xml")), None)
        if not xml_name:
            print("error: export.xml not found inside zip")
            sys.exit(1)
        # extract to temp file — iterparse on a ZipExtFile stream is very slow
        # for large files; parsing a real file is orders of magnitude faster
        xml_info = _zip.getinfo(xml_name)
        xml_gb = xml_info.file_size / 1024**3
        tmp_xml = Path(_tmpdir) / "export.xml"
        print(f"  extracting export.xml ({xml_gb:.1f} GB uncompressed)...")
        with _zip.open(xml_name) as src, open(tmp_xml, "wb") as dst:
            shutil.copyfileobj(src, dst, length=4 * 1024 * 1024)
        print(f"  streaming export.xml...")
        zip_gpx_prefix = xml_name.replace("export.xml", "workout-routes/")
        context = ET.iterparse(str(tmp_xml), events=("start", "end"))
    else:
        context = ET.iterparse(str(input_path), events=("start", "end"))

    current_workout = None
    current_stats = {}
    in_workout = False
    last_print = time.time()

    for event, elem in context:
        if event == "start":
            now = time.time()
            if now - last_print >= 5:
                if workouts_seen:
                    print(f"  {records_seen:,} records, {workouts_seen:,} workouts scanned — {count} cycling rides found...")
                else:
                    print(f"  {records_seen:,} health records scanned (no workouts yet)...")
                last_print = now
            if elem.tag == "Record":
                records_seen += 1
            elif elem.tag == "Workout":
                workouts_seen += 1

        if event == "start" and elem.tag == "Workout":
            activity = elem.get("workoutActivityType", "")
            if "Cycling" in activity:
                in_workout = True
                current_workout = dict(elem.attrib)
                current_stats = {}

        elif in_workout and event == "start" and elem.tag == "WorkoutStatistics":
            stat_type = elem.get("type", "")
            current_stats[stat_type] = dict(elem.attrib)

        elif event == "end" and elem.tag == "Workout":
            if in_workout and current_workout:
                w = current_workout

                dur_raw = float(w.get("duration", 0) or 0)
                dur_unit = w.get("durationUnit", "min")
                dur_mins = to_mins(dur_raw, dur_unit)

                if dur_mins < 5:
                    skipped += 1
                    in_workout = False
                    current_workout = None
                    elem.clear()
                    continue

                # distance — prefer cycling-specific stat
                dist_mi = 0.0
                for key in (
                    "HKQuantityTypeIdentifierDistanceCycling",
                    "HKQuantityTypeIdentifierDistanceWalkingRunning",
                ):
                    if key in current_stats:
                        s = current_stats[key]
                        v = float(s.get("sum", 0) or 0)
                        dist_mi = to_miles(v, s.get("unit", "mi"))
                        break
                if dist_mi == 0:
                    v = float(w.get("totalDistance", 0) or 0)
                    dist_mi = to_miles(v, w.get("totalDistanceUnit", "mi"))

                if dist_mi < 0.5:
                    skipped += 1
                    in_workout = False
                    current_workout = None
                    elem.clear()
                    continue

                # heart rate
                hr_avg = None
                hr_max = None
                hr_min = None
                hr_key = "HKQuantityTypeIdentifierHeartRate"
                if hr_key in current_stats:
                    hs = current_stats[hr_key]
                    hr_avg = float(hs.get("average", 0) or 0) or None
                    hr_max = float(hs.get("maximum", 0) or 0) or None
                    hr_min = float(hs.get("minimum", 0) or 0) or None

                # energy
                energy_kcal = None
                for key in (
                    "HKQuantityTypeIdentifierActiveEnergyBurned",
                    "HKQuantityTypeIdentifierBasalEnergyBurned",
                ):
                    if key in current_stats:
                        es = current_stats[key]
                        v = float(es.get("sum", 0) or 0)
                        unit = es.get("unit", "kcal")
                        energy_kcal = v if "kcal" in unit else v * 0.239001
                        break

                ride = {
                    "date": parse_date(w.get("startDate")),
                    "dist_mi": round(dist_mi, 4),
                    "dur_mins": round(dur_mins, 2),
                    "speed_mph": round((dist_mi / dur_mins) * 60, 3) if dur_mins > 0 else None,
                    "hr_avg": round(hr_avg, 1) if hr_avg else None,
                    "hr_max": round(hr_max, 1) if hr_max else None,
                    "hr_min": round(hr_min, 1) if hr_min else None,
                    "energy_kcal": round(energy_kcal, 1) if energy_kcal else None,
                    "elev_gain_ft": None,
                    "source": w.get("sourceName", None),
                }
                rides.append(ride)
                count += 1


            in_workout = False
            current_workout = None
            elem.clear()  # free memory — critical for large files

    # Deduplicate: third-party apps (Strava etc.) re-syncing to Apple Health
    # can write identical Workout records multiple times into export.xml
    seen = set()
    unique = []
    for ride in rides:
        key = (ride["date"], ride["source"])
        if key not in seen:
            seen.add(key)
            unique.append(ride)
    dupes = len(rides) - len(unique)
    if dupes:
        print(f"  removed {dupes} duplicate rides (same timestamp + source)")
    rides = unique

    rides.sort(key=lambda r: r["date"] or "")

    # GPX route files: elevation + GPS tracks
    track_data = {}
    if is_zip:
        gpx_names = [n for n in _zip.namelist() if n.startswith(zip_gpx_prefix) and n.endswith(".gpx")]
        if gpx_names:
            print(f"  extracting {len(gpx_names)} GPX files from zip...")
            for name in gpx_names:
                _zip.extract(name, _tmpdir)
            routes_dir = Path(_tmpdir) / zip_gpx_prefix
            track_data = match_gpx_to_rides(rides, routes_dir)
        else:
            print("  (no workout-routes/ found in zip — skipping elevation + tracks)")
        _zip.close()
    else:
        routes_dir = input_path.parent / "workout-routes"
        if routes_dir.is_dir():
            track_data = match_gpx_to_rides(rides, routes_dir)
        else:
            print("  (no workout-routes/ directory found — skipping elevation + tracks)")

    output = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "source_file": input_path.name,
        "total_rides": len(rides),
        "rides": rides,
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    tracks_path = Path.cwd() / "tracks.json"
    if track_data:
        with open(tracks_path, "w") as f:
            json.dump({"generated": output["generated"], "tracks": track_data}, f)
        tracks_kb = tracks_path.stat().st_size / 1024

    if _tmpdir:
        import shutil
        shutil.rmtree(_tmpdir, ignore_errors=True)

    print(f"\ndone.")
    print(f"  {count} cycling rides extracted")
    print(f"  {skipped} short/incomplete rides skipped")
    print(f"  output: {output_path}")
    if rides:
        print(f"  date range: {rides[0]['date'][:10]} → {rides[-1]['date'][:10]}")
        total_dist = sum(r['dist_mi'] for r in rides)
        total_hrs = sum(r['dur_mins'] for r in rides) / 60
        print(f"  total distance: {total_dist:.1f} miles")
        print(f"  total time: {total_hrs:.1f} hours")
        elev_rides = [r for r in rides if r.get('elev_gain_ft') is not None]
        if elev_rides:
            total_climb = sum(r['elev_gain_ft'] for r in elev_rides)
            print(f"  total elevation: {total_climb:,} ft ({len(elev_rides)} rides with GPS data)")
    if track_data:
        print(f"  tracks: {tracks_path} ({tracks_kb:.0f} KB, {len(track_data)} rides with GPS)")


if __name__ == "__main__":
    main()
