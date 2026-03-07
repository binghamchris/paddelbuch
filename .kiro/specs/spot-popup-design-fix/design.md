# Spot Popup Design Fix — Bugfix Design

## Overview

The spot popup on the Jekyll site deviates from the original Gatsby design in several ways: missing category header, missing description, raw type slugs instead of translated names, icon-only copy buttons instead of text-only "Copy"/"Kopieren" buttons, and incorrect navigate button text. The fix targets two files — `_includes/spot-popup.html` (server-rendered popup) and `assets/js/spot-popup.js` (client-side dynamic popup) — plus i18n label additions and minor SCSS adjustments. The goal is to restore the original Gatsby popup layout while preserving all existing functional behavior (clipboard, navigation, detail links, conditional section omission).

## Glossary

- **Bug_Condition (C)**: Any spot popup rendered (server-side or client-side) where the layout, labels, or content structure differs from the original Gatsby design
- **Property (P)**: The popup SHALL display the correct layout: category header → divider → large title → description → "Potentially Usable By" bullet list → GPS with text copy button → address with text copy button → action buttons ("Navigate To" + "More details")
- **Preservation**: All existing functional behaviors that must remain unchanged — clipboard copy, Google Maps navigation, detail page links, conditional section omission for missing data, rejected spot popup layout
- **spot-popup.html**: The Jekyll include template at `_includes/spot-popup.html` that renders spot popups server-side
- **spot-popup.js**: The JavaScript module at `assets/js/spot-popup.js` that generates popup HTML client-side for Leaflet map markers
- **navigate-btn.html**: The Jekyll include at `_includes/navigate-btn.html` that renders the navigation button
- **spot_types.yml**: Data file at `_data/types/spot_types.yml` mapping spot type slugs to translated names
- **paddle_craft_types.yml**: Data file at `_data/types/paddle_craft_types.yml` mapping craft type slugs to translated names

## Bug Details

### Bug Condition

The bug manifests whenever a spot popup is displayed on the map (either server-rendered via `spot-popup.html` or dynamically via `spot-popup.js`). The popup layout and content differ from the original Gatsby design in multiple ways: missing category header row, title placement, missing "Potentially Usable By" section, raw type slugs, icon-only copy buttons, and wrong navigate button text.

**Formal Specification:**
```
FUNCTION isBugCondition(popup)
  INPUT: popup of type SpotPopupRendering
  OUTPUT: boolean

  RETURN popup.headerShowsTitleInsteadOfCategory
         OR popup.craftTypesShownAsRawSlugs
         OR popup.copyButtonsAreIconOnly
         OR popup.navigateButtonTextMissing "To"/"zu"
         OR popup.layoutOrderIncorrect
         OR popup.missingPotentiallyUsableByLabel
END FUNCTION
```

### Examples

- **Category header missing**: A spot of type "einstieg-ausstieg" shows `[icon] Spot Name` in the header instead of `[icon] Entry and Exit` with the spot name as a large heading below
- **Raw craft type slugs**: A spot with `paddleCraftTypes: ["seekajak", "kanadier"]` shows "Type: seekajak, kanadier" instead of "Potentially Usable By:" followed by a bullet list: "• Sea Kayak • Canoe"
- **Icon-only copy button**: The GPS copy button shows only an SVG clipboard icon instead of a text button reading "Copy" / "Kopieren"
- **Navigate button text**: Button reads "Navigate" / "Navigieren" instead of "Navigate To" / "Navigieren zu"
- **Layout order**: Current order is header → description → GPS → address → craft types → actions; expected order is category header → divider → title → description → craft types → GPS → address → actions

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Clicking the copy button for GPS or address must continue to copy the correct value to the clipboard
- Clicking "Navigate To" must continue to open Google Maps directions to the correct coordinates
- Clicking "More details" must continue to navigate to the correct spot detail page with proper locale prefix
- Spots without description, GPS, address, or craft types must continue to omit those sections
- Rejected spot popups must continue to show the rejection-specific layout with no-entry icon
- The popup must continue to work both server-side (Jekyll include) and client-side (JavaScript)

**Scope:**
All inputs that do NOT involve spot popup rendering should be completely unaffected by this fix. This includes:
- Spot detail pages
- Map layer controls
- Obstacle and event popups
- Waterway pages
- All other site functionality

## Hypothesized Root Cause

Based on the bug description and code analysis, the issues are straightforward implementation gaps in the Jekyll migration from Gatsby:

1. **Header structure not migrated**: The `spot-popup.html` and `spot-popup.js` both place the spot name directly in the header row alongside the icon. The original Gatsby design had the spot type category label in the header and the spot name as a separate large heading below a divider. The spot type lookup from `spot_types.yml` was never implemented in the popup.

2. **Craft types label and format not migrated**: Both files use a generic "Type"/"Typ" label with comma-separated values. The original design used "Potentially Usable By"/"Potenziell nutzbar für" with a bullet list. The i18n files lack the `potentially_usable_by` translation key. Additionally, `spot-popup.js` joins raw slugs directly without looking up translated names.

3. **Copy button design differs**: Both files render an SVG clipboard icon inside the copy button. The original Gatsby design used text-only buttons ("Copy"/"Kopieren") with no icon, which is more accessible.

4. **Navigate button text incomplete**: The i18n key `actions.navigate` is "Navigate"/"Navigieren" but the original design used "Navigate To"/"Navigieren zu". The `navigate-btn.html` include and `spot-popup.js` both use the shorter text.

5. **Layout order not matching**: The section ordering in both template and JS differs from the original Gatsby design. Craft types appear after GPS/address instead of before them.

## Correctness Properties

Property 1: Bug Condition — Spot Popup Layout Matches Original Design

_For any_ spot popup rendering where the spot is not rejected, the fixed popup SHALL display: (1) a header row with the spot icon and translated spot type category label, (2) a divider, (3) the spot name as a large heading, (4) description if present, (5) "Potentially Usable By" with a bullet list of translated craft type names if present, (6) GPS with a text-only "Copy"/"Kopieren" button if present, (7) approximate address with a text-only "Copy"/"Kopieren" button if present, (8) action buttons "Navigate To"/"Navigieren zu" and "More details"/"Weitere Details".

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation — Existing Functional Behavior Unchanged

_For any_ interaction with the spot popup that does not involve layout rendering (clipboard copy, navigation link, detail page link, conditional section omission, rejected spot popup), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing clipboard, navigation, linking, and conditional display functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**


## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `_i18n/de.yml` and `_i18n/en.yml`

**Specific Changes**:
1. **Add missing i18n keys**: Add `labels.potentially_usable_by` ("Potenziell nutzbar für" / "Potentially Usable By"), `actions.copy` text is already present, and update `actions.navigate` to "Navigieren zu" / "Navigate To"

---

**File**: `_includes/spot-popup.html`

**Specific Changes**:
1. **Restructure header**: Replace `spot.name` in the header with the translated spot type category label looked up from `site.data.types.spot_types` using `spot_type_slug`. Show the icon + category label in the header row.
2. **Add divider and title**: After the header, add an `<hr>` divider followed by the spot name as a prominent heading (e.g., `<h3>` or styled `<div>`).
3. **Reorder sections**: Move the craft types section to appear after description and before GPS/address.
4. **Change craft types label and format**: Replace `labels.type` with `labels.potentially_usable_by`. Change from comma-separated inline text to a `<ul>` bullet list of translated craft type names.
5. **Replace copy button icons with text**: Remove the SVG clipboard icon from both GPS and address copy buttons. Replace with the translated text from `actions.copy` ("Copy" / "Kopieren"). The buttons must be text-only with no icon for accessibility.
6. **Update navigate button text**: The `navigate-btn.html` include uses `actions.navigate` — updating the i18n value to "Navigate To" / "Navigieren zu" will fix this across all usages.

---

**File**: `assets/js/spot-popup.js`

**Function**: `generateSpotPopupContent`

**Specific Changes**:
1. **Restructure header**: Look up the spot type translated name from a type map (passed as data or embedded). Show icon + category label in header, then divider, then spot name as heading.
2. **Add spot type translation map**: Add a `spotTypeNames` object mapping slugs to `{ de: ..., en: ... }` translated names, sourced from `spot_types.yml` data.
3. **Add paddle craft type translation map**: Add a `paddleCraftTypeNames` object mapping slugs to `{ de: ..., en: ... }` translated names, sourced from `paddle_craft_types.yml` data.
4. **Reorder sections**: Move craft types to appear after description and before GPS/address.
5. **Change craft types label and format**: Update `getLabels()` to include `potentiallyUsableBy` label. Render craft types as a `<ul>` bullet list with translated names instead of comma-separated raw slugs.
6. **Replace copy button icons with text**: Update GPS and address copy button rendering to show translated "Copy"/"Kopieren" text instead of the SVG icon.
7. **Update navigate button text**: Change `navigate` label in `getLabels()` to "Navigate To" / "Navigieren zu".

---

**File**: `_includes/navigate-btn.html`

**Specific Changes**:
1. **No code change needed**: The navigate button text comes from `actions.navigate` i18n key. Updating the i18n value will propagate here automatically.

---

**File**: `_sass/components/_map.scss`

**Specific Changes**:
1. **Add styles for new elements**: Add styles for `.spot-popup-category` (header category label), `.spot-popup-title` (large spot name heading), `.spot-popup-divider` (hr between header and title), and `.spot-popup-craft-list` (bullet list styling for craft types).
2. **Update copy button styles**: Adjust `.copy-btn` padding/sizing for text content instead of icon-only.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write Jest tests that render spot popup HTML (both via `spot-popup.js` and by inspecting the template structure) and assert the expected layout structure, labels, and content. Run these tests on the UNFIXED code to observe failures and confirm root causes.

**Test Cases**:
1. **Header Category Test**: Assert that the popup header contains a translated spot type label (e.g., "Entry and Exit") instead of the spot name (will fail on unfixed code)
2. **Craft Types Format Test**: Assert that craft types are rendered as a `<ul>` bullet list with translated names and a "Potentially Usable By" label (will fail on unfixed code)
3. **Copy Button Text Test**: Assert that copy buttons contain text "Copy"/"Kopieren" and no SVG element (will fail on unfixed code)
4. **Navigate Button Text Test**: Assert that the navigate button text is "Navigate To"/"Navigieren zu" (will fail on unfixed code)
5. **Layout Order Test**: Assert that craft types section appears before GPS section in the DOM (will fail on unfixed code)

**Expected Counterexamples**:
- Header contains spot name instead of category label
- Craft types rendered as comma-separated slugs with "Type" label
- Copy buttons contain `<svg>` elements and no visible text
- Navigate button text is "Navigate" not "Navigate To"
- Possible causes: missing i18n keys, missing type lookups, template structure not matching original design

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL spot WHERE NOT spot.rejected DO
  popup := renderSpotPopup(spot, locale)
  ASSERT popup.header contains translatedSpotTypeName(spot.spotType_slug, locale)
  ASSERT popup.title contains spot.name as prominent heading
  ASSERT popup.craftTypes rendered as bullet list with translated names
  ASSERT popup.copyButtons contain text label, no SVG icon
  ASSERT popup.navigateButton text is "Navigate To" / "Navigieren zu"
  ASSERT popup.sectionOrder is [header, divider, title, description, craftTypes, gps, address, actions]
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL spot, action WHERE action IN [copyGPS, copyAddress, navigateClick, detailsClick] DO
  ASSERT fixedPopup.functionalBehavior(action) = originalPopup.functionalBehavior(action)
END FOR

FOR ALL spot WHERE spot.description IS NULL DO
  ASSERT fixedPopup does NOT contain description section
END FOR

FOR ALL spot WHERE spot.location IS NULL DO
  ASSERT fixedPopup does NOT contain GPS section
  ASSERT fixedPopup does NOT contain navigate button
END FOR

FOR ALL spot WHERE spot.rejected DO
  ASSERT fixedPopup uses rejectedSpotPopup layout unchanged
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many spot configurations automatically across the input domain
- It catches edge cases with missing fields that manual unit tests might miss
- It provides strong guarantees that conditional omission behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for clipboard, navigation, and conditional display, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Clipboard Preservation**: Verify that clicking copy buttons still copies the correct GPS/address value to clipboard after the fix
2. **Navigation Link Preservation**: Verify that the navigate button still links to the correct Google Maps URL with proper coordinates
3. **Detail Link Preservation**: Verify that "More details" still links to the correct spot detail page with locale prefix
4. **Conditional Omission Preservation**: Verify that spots missing description/GPS/address/craft types still omit those sections
5. **Rejected Popup Preservation**: Verify that rejected spot popups are completely unchanged

### Unit Tests

- Test `generateSpotPopupContent()` output structure for various spot configurations
- Test spot type slug to translated name lookup for all known spot types
- Test paddle craft type slug to translated name lookup for all known craft types
- Test copy button HTML contains text label and no SVG
- Test navigate button text matches expected "Navigate To" / "Navigieren zu"
- Test layout section ordering in generated HTML
- Test edge cases: spot with no craft types, no GPS, no address, no description

### Property-Based Tests

- Generate random spot objects with varying combinations of optional fields and verify the popup always renders the correct layout structure
- Generate random spot type slugs and verify the header always shows the translated category name (or a sensible fallback)
- Generate random paddle craft type slug arrays and verify they always render as a bullet list with translated names
- Generate random spot configurations and verify conditional section omission is preserved (no description → no description section, etc.)

### Integration Tests

- Test full popup rendering in both server-side (Jekyll include) and client-side (JavaScript) paths produce equivalent structure
- Test that i18n keys resolve correctly for both `de` and `en` locales
- Test that copy button click handler still functions after changing from icon to text button
- Test that the popup renders correctly within a Leaflet map popup container
