# Bugfix Requirements Document

## Introduction

On spot detail pages (`_layouts/spot.html`), the map marker for the spot is not displayed. The JavaScript code references a non-existent module name (`PaddelbuchMarkers`) and method (`getMarkerIcon`), causing a silent runtime error. The actual module is `PaddelbuchMarkerStyles` with method `getSpotIcon`, as correctly used elsewhere in the codebase (e.g., `_includes/layer-control.html`). This results in spot detail pages showing an empty map with no marker.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user visits any spot detail page THEN the system fails silently with a JavaScript error (`PaddelbuchMarkers is not defined`) and no marker is displayed on the map

1.2 WHEN the spot detail page JavaScript calls `PaddelbuchMarkers.getMarkerIcon(spotType, isRejected)` THEN the system throws a ReferenceError because the module is exported as `PaddelbuchMarkerStyles` and the method is named `getSpotIcon`

### Expected Behavior (Correct)

2.1 WHEN a user visits any spot detail page THEN the system SHALL display a marker on the map at the spot's GPS coordinates with the correct icon for the spot type

2.2 WHEN the spot detail page JavaScript requests a marker icon THEN the system SHALL call `PaddelbuchMarkerStyles.getSpotIcon(spotType, isRejected)` to obtain the correct Leaflet icon instance

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the main map page uses `PaddelbuchMarkerStyles.getSpotIcon()` via `_includes/layer-control.html` THEN the system SHALL CONTINUE TO display spot markers correctly on the main map

3.2 WHEN a user visits a waterway, obstacle, or notice detail page THEN the system SHALL CONTINUE TO display those detail pages with their existing map layers and markers unchanged

3.3 WHEN a rejected spot detail page is visited THEN the system SHALL CONTINUE TO display the rejected spot marker (no-entry icon) via the same corrected API call

---

### Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PageRequest
  OUTPUT: boolean
  
  // Returns true when the page is a spot detail page
  RETURN X.layout = "spot" AND X.page contains spot location data
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - Spot detail marker display
FOR ALL X WHERE isBugCondition(X) DO
  result ← renderSpotDetailPage'(X)
  ASSERT result.map.markers.length = 1
    AND result.map.markers[0].position = (X.spot.lat, X.spot.lon)
    AND result.map.markers[0].icon = PaddelbuchMarkerStyles.getSpotIcon(X.spotType, X.isRejected)
    AND no_javascript_error(result)
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking - All non-spot-detail pages unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
