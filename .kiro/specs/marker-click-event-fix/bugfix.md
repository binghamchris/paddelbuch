# Bugfix Requirements Document

## Introduction

The Tinylytics `marker.click` events are not being recorded in production. When users click map markers (spot markers, event notice markers) or GeoJSON layers (obstacle polygons, protected area polygons), the interaction is silently lost. This means the site owner has no visibility into which map entities attract the most interest.

The root cause is an architectural mismatch between Tinylytics' event mechanism and Leaflet's click handling. Tinylytics is purely attribute-based — it listens for DOM click events on elements carrying `data-tinylytics-event`. The current implementation places `marker.click` attributes on the outermost wrapper `<div>` of popup content HTML. However, when a user clicks a Leaflet marker or GeoJSON layer, the click lands on Leaflet's internal DOM elements (marker icon `<img>`, canvas/SVG path), not on the popup HTML. Leaflet intercepts the click, opens the popup, and injects the popup HTML into the DOM — but the original click event never reaches the popup content wrapper div. The `marker.click` event only fires if someone clicks inside an already-open popup on non-interactive content (title, description text), which almost never happens in practice.

The Tinylytics documentation confirms there is no client-side JavaScript API for programmatic event sending. Events can only be triggered via DOM click events on annotated elements. The fix must therefore dispatch synthetic click events on a hidden beacon element carrying the appropriate `data-tinylytics-event` attributes, triggered from Leaflet's own `click` event on each marker/layer.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user clicks a spot marker on the map THEN the system fails to record a `marker.click` Tinylytics event because the click lands on Leaflet's internal marker icon element, not on the popup content wrapper div that carries the `data-tinylytics-event` attribute

1.2 WHEN a user clicks an obstacle polygon on the map THEN the system fails to record a `marker.click` Tinylytics event because the click lands on Leaflet's internal SVG/canvas path element, not on the popup content wrapper div

1.3 WHEN a user clicks an event notice marker on the map THEN the system fails to record a `marker.click` Tinylytics event because the click lands on Leaflet's internal marker icon element, not on the popup content wrapper div

1.4 WHEN a user clicks a protected area polygon on the map THEN the system fails to record a `marker.click` Tinylytics event because the click lands on Leaflet's internal SVG/canvas path element, not on the popup content wrapper div

1.5 WHEN the popup content wrapper div carries `data-tinylytics-event="marker.click"` THEN the attribute is inert for the marker-click use case because no user click event naturally reaches that element at the moment the marker is clicked

### Expected Behavior (Correct)

2.1 WHEN a user clicks a spot marker on the map THEN the system SHALL record a `marker.click` Tinylytics event with the spot slug as the event value

2.2 WHEN a user clicks an obstacle polygon on the map THEN the system SHALL record a `marker.click` Tinylytics event with the obstacle slug as the event value

2.3 WHEN a user clicks an event notice marker on the map THEN the system SHALL record a `marker.click` Tinylytics event with the notice slug as the event value

2.4 WHEN a user clicks a protected area polygon on the map THEN the system SHALL record a `marker.click` Tinylytics event with the protected area slug or name as the event value

2.5 WHEN the system dispatches a synthetic `marker.click` event THEN it SHALL use a hidden beacon element with `data-tinylytics-event` and `data-tinylytics-event-value` attributes, and dispatch a synthetic DOM `click` event that Tinylytics' document-level event delegation will capture

2.6 WHEN the system creates the hidden beacon element THEN it SHALL use a CSS class (not inline styles) to hide the element, complying with the `style-src 'self'` Content Security Policy

2.7 WHEN the `marker.click` wrapper div is no longer needed on popup content HTML THEN the system SHALL remove the `data-tinylytics-event="marker.click"` wrapper div from all popup generators (`spot-popup.js`, `obstacle-popup.js`, `event-notice-popup.js`) and fallback HTML strings in `layer-control.js`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user clicks a "Navigate" button inside a spot popup THEN the system SHALL CONTINUE TO record a `popup.navigate` Tinylytics event with the spot slug as the event value

3.2 WHEN a user clicks a "More details" button inside any popup THEN the system SHALL CONTINUE TO record a `popup.details` Tinylytics event with the entity slug as the event value

3.3 WHEN a user interacts with filter panel checkboxes THEN the system SHALL CONTINUE TO record `filter.change` and `layer.toggle` Tinylytics events with the correct values

3.4 WHEN a user clicks dashboard switcher tabs THEN the system SHALL CONTINUE TO record `dashboard.switch` Tinylytics events with the dashboard id as the event value

3.5 WHEN the Tinylytics script is loaded THEN the system SHALL CONTINUE TO use the `?events&beacon` query parameters on the script URL

3.6 WHEN popup content is generated for any entity type THEN the system SHALL CONTINUE TO display the correct popup structure (title, details table, buttons) without visual or functional changes

3.7 WHEN the hidden beacon element dispatches a synthetic click THEN the system SHALL NOT introduce any inline scripts, inline style attributes, `eval()`, or `new Function()` calls, preserving CSP compliance

---

### Bug Condition (Structured Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type UserClickEvent
  OUTPUT: boolean

  // Returns true when the click targets a Leaflet map marker or GeoJSON layer
  // These clicks land on Leaflet's internal DOM elements, never reaching
  // the popup content wrapper div that carries data-tinylytics-event
  RETURN X.target IS LeafletMarker OR X.target IS LeafletGeoJSONLayer
END FUNCTION
```

**Property: Fix Checking — marker.click events fire on marker/layer click**
```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleMarkerClick'(X)
  ASSERT tinylyticsEventFired(result, 'marker.click', X.entity.slug)
END FOR
```

**Property: Preservation Checking — non-marker interactions unchanged**
```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

This ensures that for all non-buggy inputs (popup button clicks, filter checkbox changes, dashboard tab clicks, language switches), the fixed code behaves identically to the original.
