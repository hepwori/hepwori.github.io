# the price of sunshine

editorial quadrant scatterplot of median home price (log scale) against average annual hours of sunshine, across 53 US metros, colored by region.

## data

- **sunshine hours**: average annual hours of sunshine per city. Mostly NOAA-derived figures via [Current Results](https://www.currentresults.com/Weather/US/average-annual-sunshine-by-city.php). 6 cities Current Results doesn't have hours for (Fresno, Honolulu, Los Angeles, San Francisco, Tucson, Tulsa) were filled from [Wikipedia's "List of cities by sunshine duration"](https://en.wikipedia.org/wiki/List_of_cities_by_sunshine_duration) (same underlying climate-normal data, summed from monthly figures) — cross-checked to the hour against the ~46 cities present in both sources, and against an independently-published sunniest-cities ranking. One city, **Grand Rapids**, has no published hours figure anywhere found (marked `*` in the table, dashed dot outline on the chart); its value is *estimated* — see Design notes below.
- `data.json` also still carries `sunshineDays` (average annual clear days, same Current Results table) from the first version of this chart, unused by the current hours-based view but kept for reference.
- **home prices**: [Zillow Home Value Index](https://www.zillow.com/research/data/) (ZHVI, all homes, smoothed & seasonally adjusted), latest month at time of writing (July 2026).
- **region**: hand-assigned Census-style groupings (Pacific, Mountain West, Southwest, Texas & South Central, Southeast, Midwest, Mid-Atlantic, New England) — not from an official source, just a reasonable regional split for the color layer.

`data.json` is a static snapshot — pulled by hand, not refreshed automatically. To update, re-download the ZHVI city CSV from Zillow Research and re-match against the sunshine list.

## design notes

- x-axis is **log-scaled** (price spans $76K–$1.42M) so cheap and expensive metros both stay legible; the trend line is fit in log-price space so it renders straight.
- quadrants split at the sample medians (2,641 sunshine hours, $338K).
- region color (8 categories) fails the dataviz skill's strict CVD all-pairs check for scatter plots — a deliberate tradeoff to match a reference chart's regional-coloring style. Mitigated by: city identity always carries a direct text label, a hover tooltip, and a table row — never color alone.
- city labels are placed with a greedy collision-avoidance pass (real SVG `getBBox()` measurement, checked against both other labels and other cities' dots) so labels don't overlap. Not every city gets a label in the densest clusters; all 53 are always in the table.
- **Grand Rapids' estimate**: NOAA's NCEI Comparative Climatic Data publishes "percent of possible sunshine" (a cloud-cover-based measure) for far more stations than it publishes actual sunshine-hour totals for — Grand Rapids has the former (46% annual) but not the latter. Percent-of-possible × the total hours of daylight possible in a year is the standard way "hours of sunshine" figures are derived in the first place, so this multiplies Grand Rapids' 46% by ~4,685 hours — an "annual possible sunshine hours" constant back-calculated from Detroit and Milwaukee, the two nearby Great Lakes stations where both the percent and an actual published hours figure exist (their implied constants: 4,684 and 4,685 — reassuringly close to each other and to the ~4,590 average across a dozen similar-latitude cities checked). Net estimate: **2,155 hours**, flagged via `sunshineHoursEstimated: true` in the data.

## finding

hours of sunshine correlate with price slightly better than sunny days did (r ≈ 0.32 vs. 0.29, both in log-price space) — still a weak relationship. money follows coastlines and tech hubs (San Francisco, Seattle) more than it follows sunshine; some of the sunniest cities (Phoenix, Las Vegas, Tucson) are mid-priced, while some of the cloudiest (Seattle, Boston, New York) are among the most expensive.
