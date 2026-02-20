# Detail Page Spots Missing — Tasks

## Tasks

- [x] 1. Fix the marker icon call in spot.html
  - [x] 1.1 Replace `PaddelbuchMarkers.getMarkerIcon(spotType, isRejected)` with `PaddelbuchMarkerStyles.getSpotIcon(spotType, isRejected)` in `_layouts/spot.html`
- [x] 2. Verify preservation of other layouts
  - [x] 2.1 Confirm `_layouts/waterway.html` is unchanged and does not reference `PaddelbuchMarkers`
  - [x] 2.2 Confirm `_layouts/obstacle.html` is unchanged and does not reference `PaddelbuchMarkers`
  - [x] 2.3 Confirm `_layouts/notice.html` is unchanged and does not reference `PaddelbuchMarkers`
  - [x] 2.4 Confirm `_includes/layer-control.html` still uses `PaddelbuchMarkerStyles.getSpotIcon()` correctly
- [x] 3. Verify the fix
  - [x] 3.1 Build the Jekyll site and confirm no build errors
  - [x] 3.2 Verify spot detail pages display a marker on the map at the correct coordinates
