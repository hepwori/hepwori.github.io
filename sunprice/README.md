# the price of sunshine

editorial quadrant scatterplot of median home price (log scale) against average annual sunny (clear) days, across 53 US metros, colored by region.

## data

- **sunshine**: average annual clear days per city (NOAA-derived), from [Current Results](https://www.currentresults.com/Weather/US/average-annual-sunshine-by-city.php). "clear days" = days where cloud cover is at most 30% during daylight hours.
- **home prices**: [Zillow Home Value Index](https://www.zillow.com/research/data/) (ZHVI, all homes, smoothed & seasonally adjusted), latest month at time of writing (July 2026).
- **region**: hand-assigned Census-style groupings (Pacific, Mountain West, Southwest, Texas & South Central, Southeast, Midwest, Mid-Atlantic, New England) — not from an official source, just a reasonable regional split for the color layer.

`data.json` is a static snapshot — pulled by hand, not refreshed automatically. To update, re-download the ZHVI city CSV from Zillow Research and re-match against the sunshine list.

## design notes

- x-axis is **log-scaled** (price spans $76K–$1.42M) so cheap and expensive metros both stay legible; the trend line is fit in log-price space so it renders straight.
- quadrants split at the sample medians (101 sunny days, $338K).
- region color (8 categories) fails the dataviz skill's strict CVD all-pairs check for scatter plots — a deliberate tradeoff to match a reference chart's regional-coloring style. Mitigated by: city identity always carries a direct text label, a hover tooltip, and a table row — never color alone.
- city labels are placed with a greedy collision-avoidance pass (real SVG `getBBox()` measurement, checked against both other labels and other cities' dots) so labels don't overlap. Not every city gets a label in the densest clusters; all 53 are always in the table.

## finding

weak positive correlation (r ≈ 0.29 in log-price space) — sunnier cities skew only slightly pricier. money follows coastlines and tech hubs (San Francisco, Seattle) more than it follows sunshine; some of the sunniest cities (Phoenix, Las Vegas, Tucson) are mid-priced, while some of the cloudiest (Seattle, Boston, New York) are among the most expensive.
