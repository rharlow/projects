# Photo Atlas

A private map of where and when your Google Photos were taken. Markers show the approximate location and photo count, the timeline shows photos per month, and the slider (or a click on any bar) filters the map to a single month-year. Press play to step through your history month by month.

## Why Takeout

Since March 2025 the Google Photos Library API only exposes photos an app uploaded itself, and the Picker API strips location data. The only reliable way to get your whole library's dates and locations is a Google Takeout export, which includes a `.json` sidecar for every photo with `photoTakenTime` and `geoData`.

## Use it

1. Go to [takeout.google.com](https://takeout.google.com), click **Deselect all**, check **Google Photos**, choose **.zip**, and export.
2. Serve this folder locally and open it:
   ```sh
   cd photo-map
   python3 -m http.server 8000
   # open http://localhost:8000
   ```
3. Click **Load Google Photos** and drop in every Takeout `.zip` part (or an unzipped Takeout folder).

Only the small `.json` sidecars are read, straight out of the zips, so a 100 GB export loads in a minute or two without unzipping. Duplicates (the same photo in an album folder and a year folder) are counted once. If Google's own location is missing, the camera's EXIF location is used. Photos with no location are counted in the header but not mapped.

## Privacy

- Your photos and metadata never leave the browser. The parsed dates and coordinates are cached in this browser's IndexedDB so you don't have to re-import; **Use demo data** in the import dialog clears it.
- Map tiles come from CARTO/OpenStreetMap, which sees the map area you're viewing.
- Place names are looked up from OpenStreetMap Nominatim using coordinates rounded to about 10 km, one request per second, cached locally. Uncheck **Show place names** to turn this off.

## Files

- `index.html`: the whole app.
- `vendor/`: Leaflet 1.9.4 and zip.js 2.7.52 (inflate-only build), bundled so nothing loads from a CDN.
