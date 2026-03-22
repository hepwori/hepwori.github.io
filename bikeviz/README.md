# cycling dashboard

personal road cycling analytics from apple health data.

## setup

### 1. export apple health data

on your iphone: **health app → your avatar (top right) → export all health data**

this produces a zip. unzip it — you'll get a directory containing `export.xml` and a `workout-routes/` folder with GPX files. the XML will be large (1–3 GB is normal).

### 2. extract your rides

```bash
python3 parse_health.py /path/to/export.xml
```

this streams through the XML, extracts cycling workouts, and writes two files next to your `export.xml`:

- **`rides.json`** — summary stats for every ride
- **`tracks.json`** — downsampled GPS tracks for route map visualization (only generated if `workout-routes/` is present)

the parser prints progress every few seconds. expect 1–3 minutes for a large export with GPS data.

### 3. open the dashboard

serve the directory and open `index.html`:

```bash
cd /path/to/bikeviz
python3 -m http.server 8000
# then open http://localhost:8000
```

requires an internet connection to load chart.js from CDN.

## features

- **overview metrics** — total rides, distance, time, routes found, total climbing (if GPS data available)
- **date filter** — toggle individual years on/off, or limit to last N rides
- **rides per month** — bar chart, reflects active filter
- **distance scatter** — all rides over time
- **cumulative distance** — running total over the filtered date range
- **cumulative elevation gain** — running total climbing (if GPS data available)
- **route detection** — automatic clustering by distance with adjustable epsilon slider
- **route renaming** — labels persist in-session
- **route map** — GPS track overlay for all rides on the selected route, colored by elevation (blue=low → green → red=high)
- **per-route ride traces** — multi-series chart (x=distance, y=elapsed time), one line per ride, colored by date
- **HR trend** — per-route heart rate over time (when data available)

## re-running after a new export

just re-run `parse_health.py` with the new `export.xml`. both output files will be regenerated.

## notes

- duplicate rides from Strava re-syncing are automatically removed
- rides under 5 minutes or 0.5 miles are filtered out
- elevation uses the Apple Watch barometric altimeter (accurate) not GPS
- route clustering is distance-only — rides of similar length on different courses will be grouped together; the route map makes this visible
