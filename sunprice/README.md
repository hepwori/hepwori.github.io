# sunshine vs. home prices

scatterplot of median home price against average annual sunny (clear) days, across 53 US metros.

## data

- **sunshine**: average annual clear days per city (NOAA-derived), from [Current Results](https://www.currentresults.com/Weather/US/average-annual-sunshine-by-city.php). "clear days" = days where cloud cover is at most 30% during daylight hours.
- **home prices**: [Zillow Home Value Index](https://www.zillow.com/research/data/) (ZHVI, all homes, smoothed & seasonally adjusted), latest month at time of writing (July 2026).

`data.json` is a static snapshot — pulled by hand, not refreshed automatically. To update, re-download the ZHVI city CSV from Zillow Research and re-match against the sunshine list.

## finding

weak positive correlation (r ≈ 0.26) — sunnier cities skew only slightly pricier. money follows coastlines and tech hubs (San Francisco, Seattle) more than it follows sunshine; some of the sunniest cities (Phoenix, Las Vegas, Tucson) are mid-priced, while some of the cloudiest (Seattle, Boston, New York) are among the most expensive.
