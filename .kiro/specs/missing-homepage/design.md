# Missing Homepage Bugfix Design

## Overview

The homepage of the Paddel Buch site is missing after the Gatsby-to-Jekyll migration. No `index.html` file exists in the project root, so navigating to `/` results in a 404. The fix is straightforward: create an `index.html` with the correct front matter (`layout: default`, `pageName: home`) and body content that includes the map initialization (`map-init.html`). The existing SCSS (`_sass/pages/_home.scss`), layout (`_layouts/default.html`), and includes (`_includes/map-init.html`, `_includes/layer-control.html`) already support the homepage — only the page file itself is missing.

## Glossary

- **Bug_Condition (C)**: A request to the root URL (`/`) that should serve the homepage but instead returns a 404 because no `index.html` source file exists
- **Property (P)**: The homepage is served with a full-screen interactive map centered on Switzerland using the `default` layout and `pageName: home`
- **Preservation**: All existing pages (404, lakes, rivers, API, detail pages, localized pages) must continue to build and render correctly
- **`index.html`**: The missing Jekyll source file in the project root that would generate the homepage at `/`
- **`map-init.html`**: The include partial that initializes a Leaflet map with Switzerland center coordinates, bounds, and zoom controls
- **`layer-control.html`**: The include partial that adds spot/obstacle/event/protected-area layer toggles to the map
- **`page-home`**: The CSS class applied to `<body>` via `pageName: home` front matter, which triggers full-screen map styles in `_sass/pages/_home.scss`

## Bug Details

### Fault Condition

The bug manifests when any user or crawler requests the root URL (`/`). Jekyll has no source file to process for the homepage, so `_site/index.html` is never generated. The `default` layout, homepage SCSS, map includes, and header brand link all assume a homepage exists, but the file was never created during the migration from Gatsby.

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type HTTPRequest
  OUTPUT: boolean
  
  RETURN request.path == "/"
         AND NOT fileExists("index.html", projectRoot)
         AND NOT fileExists("index.md", projectRoot)
END FUNCTION
```

### Examples

- User navigates to `https://www.paddelbuch.ch/` → gets 404 instead of the homepage map
- User clicks the "Paddel Buch" brand logo in the header → navigates to `/` which returns 404
- User clicks "Back to Home" on the 404 page → navigates to `/` which itself is a 404
- Search engine crawls the root URL → receives 404, harming SEO indexing

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All existing pages (`404.html`, `gewaesser/seen.html`, `gewaesser/fluesse.html`, `offene-daten/api/`, detail pages) must continue to build and render identically
- The `default` layout, header, footer, and all includes must remain unmodified
- All collections (spots, waterways, obstacles, notices, static_pages) must continue to generate their pages
- English locale pages under `/en/` must continue to work correctly
- The Jekyll build process must not produce new warnings or errors

**Scope:**
All requests to paths other than `/` (and `/en/` for the English locale) are completely unaffected by this fix. The change is purely additive — a single new file.

## Hypothesized Root Cause

Based on the bug description, the root cause is clear:

1. **Missing Source File**: During the Gatsby-to-Jekyll migration, the homepage source file (`index.html` or `index.md`) was never created. Gatsby generates pages programmatically via `gatsby-node.js` and React components, while Jekyll requires an explicit source file in the project root. This file was simply omitted.

2. **No Build Error**: Jekyll does not require an `index.html` to build successfully — it silently produces a site without a homepage. This means the omission went unnoticed during the migration.

## Correctness Properties

Property 1: Fault Condition - Homepage Serves Interactive Map

_For any_ request to the root URL (`/`), the site SHALL serve an HTML page using the `default` layout with `pageName: home`, containing a full-screen interactive Leaflet map centered on Switzerland (lat: 46.801111, lon: 8.226667) with layer controls.

**Validates: Requirements 2.1, 2.3, 2.4**

Property 2: Preservation - Existing Pages Unchanged

_For any_ request to a path other than `/` (e.g., `/gewaesser/seen/`, `/gewaesser/fluesse/`, `/offene-daten/api/`, `/404.html`, detail pages), the site SHALL produce the same output as before the fix, with no modifications to existing files.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `index.html` (new file in project root)

**Specific Changes**:
1. **Create `index.html`**: Add a new file in the project root with Jekyll front matter specifying `layout: default`, `pageName: home`, and `permalink: /`
2. **Include map initialization**: The page body includes `{% include map-init.html %}` which renders the full-screen Leaflet map centered on Switzerland with all layer controls
3. **No other files modified**: The existing layout, SCSS, and includes already support `pageName: home` — no changes needed elsewhere

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the bug exists on unfixed code (no `index.html` in `_site/`), then verify the fix generates the correct homepage and preserves all existing pages.

### Exploratory Fault Condition Checking

**Goal**: Confirm the bug exists by verifying no `index.html` is generated in `_site/` before the fix.

**Test Plan**: Build the site with Jekyll and check for the presence and content of `_site/index.html`.

**Test Cases**:
1. **Missing File Test**: Verify `_site/index.html` does not exist after a Jekyll build (will fail on unfixed code — file is absent)
2. **404 Response Test**: Verify that requesting `/` returns a 404 or directory listing (will fail on unfixed code)

**Expected Counterexamples**:
- `_site/index.html` does not exist
- No homepage content is served at `/`

### Fix Checking

**Goal**: Verify that after adding `index.html`, the homepage is correctly generated.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  result := jekyllBuild() AND readFile("_site/index.html")
  ASSERT fileExists("_site/index.html")
  ASSERT result CONTAINS "page-home"
  ASSERT result CONTAINS "map-container"
  ASSERT result CONTAINS "46.801111"
  ASSERT result CONTAINS "8.226667"
END FOR
```

### Preservation Checking

**Goal**: Verify that all existing pages continue to build identically after the fix.

**Pseudocode:**
```
FOR ALL page WHERE NOT isBugCondition(page) DO
  ASSERT buildOutput_before(page) == buildOutput_after(page)
END FOR
```

**Testing Approach**: Compare the `_site/` output for all existing pages before and after adding `index.html`. Since the fix is purely additive (one new file, no modifications), preservation is inherently guaranteed — but we verify by checking that existing files in `_site/` are unchanged.

**Test Cases**:
1. **404 Page Preservation**: Verify `_site/404.html` content is identical before and after the fix
2. **Lakes Page Preservation**: Verify `_site/gewaesser/seen/index.html` is identical before and after
3. **Rivers Page Preservation**: Verify `_site/gewaesser/fluesse/index.html` is identical before and after
4. **English Locale Preservation**: Verify `/en/` pages are generated correctly after the fix

### Unit Tests

- Verify `index.html` has correct front matter (`layout: default`, `pageName: home`)
- Verify the generated `_site/index.html` contains the map container div
- Verify the generated page includes map-init.html with correct Switzerland coordinates

### Property-Based Tests

- Generate random sets of existing page paths and verify they all still resolve correctly after the fix
- Verify the homepage body class includes `page-home` for correct SCSS application

### Integration Tests

- Full Jekyll build succeeds without errors after adding `index.html`
- Homepage renders with interactive map in a browser
- Header brand logo link (`/`) navigates to the homepage successfully
- 404 page "Back to Home" link navigates to the homepage successfully
