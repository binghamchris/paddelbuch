# Notice Page Fixes Bugfix Design

## Overview

The migration from Gatsby to Jekyll introduced three structural and formatting issues on notice detail pages (`/gewaesserereignisse/:slug/`). The notice layout renders redundant summary (`Kurzfassung`) elements via the `{{ content }}` Liquid block, displays an extraneous "Gewässerereignisse" text label in the notice-icon-div that acts as an unlinked breadcrumb, and uses the generic `localized_date` filter for all dates instead of the design-system-specific formats (`YYYY-MM-DD` for start dates, `dd. MMMM YYYY um HH:MM` for updated timestamps).

The fix targets three files: `_layouts/notice.html` (suppress `{{ content }}` rendering), `_includes/notice-detail-content.html` (remove extraneous label, fix date formatting), and `_plugins/locale_filter.rb` (add notice-specific date format helpers or use existing format options).

## Glossary

- **Bug_Condition (C)**: A notice detail page is rendered — the page uses `layout: notice` and belongs to the `notices` collection
- **Property (P)**: The notice page displays a single clean content flow with no redundant Kurzfassung elements, no extraneous Gewässerereignisse breadcrumb/label, and dates formatted per design system conventions
- **Preservation**: All non-notice pages, the notice map, the notice details panel (type badge, title, waterway links, description), and mobile navigation must remain unchanged
- **notice.html**: The layout in `_layouts/notice.html` that renders the notice detail page with map + details panel
- **notice-detail-content.html**: The include in `_includes/notice-detail-content.html` that renders the notice details table and description
- **localized_date**: The Liquid filter in `_plugins/locale_filter.rb` that formats dates according to locale (DD.MM.YYYY for de, DD/MM/YYYY for en)
- **localized_datetime**: The Liquid filter in `_plugins/locale_filter.rb` that formats datetimes with time component

## Bug Details

### Bug Condition

The bugs manifest when any page from the `notices` collection is rendered using the `notice` layout. Three distinct issues occur simultaneously:

1. The `notice.html` layout extends `default.html` which renders `{{ content }}`. Since the collection generator creates virtual documents from Contentful data, the `description` field may be rendered as body content via `{{ content }}`, producing redundant `h3` and `p` elements for the summary that duplicate what `notice-detail-content.html` already renders.

2. The `notice-detail-content.html` include or the notice layout itself renders a "Gewässerereignisse" text label (via `{% t event_notices.title %}`) in the `notice-icon-div`, which appears as an extraneous breadcrumb/navigation element on the page.

3. The `notice-detail-content.html` include uses `{{ notice.startDate | localized_date }}` and `{{ notice.updatedAt | localized_date }}` which produce `DD.MM.YYYY` format, but the design system requires `YYYY-MM-DD` for start dates and `dd. MMMM YYYY um HH:MM` for updated timestamps.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PageRenderRequest
  OUTPUT: boolean

  RETURN input.page.collection == 'notices'
         AND input.page.layout == 'notice'
         AND (
           hasRedundantKurzfassungElements(input.renderedHTML)
           OR hasExtraneousGewaesserereignisseLink(input.renderedHTML)
           OR hasIncorrectDateFormat(input.renderedHTML, input.page)
         )
END FUNCTION

FUNCTION hasRedundantKurzfassungElements(html)
  summaryHeadings = html.querySelectorAll('h2, h3').filter(el => el.text contains 'Kurzfassung')
  RETURN summaryHeadings.count > 1
         OR html contains duplicate description content
END FUNCTION

FUNCTION hasExtraneousGewaesserereignisseLink(html)
  detailsPanel = html.querySelector('.notice-description')
  RETURN detailsPanel contains text 'Gewässerereignisse' as standalone label/link
         outside of the intended notice-icon-div context
END FUNCTION

FUNCTION hasIncorrectDateFormat(html, page)
  IF page.startDate EXISTS THEN
    startDateCell = html.querySelector('td containing startDate')
    IF NOT startDateCell.text matches /^\d{4}-\d{2}-\d{2}$/ THEN RETURN true
  END IF
  IF page.updatedAt EXISTS THEN
    updatedCell = html.querySelector('td containing updatedAt')
    IF NOT updatedCell.text matches /^\d{2}\. \w+ \d{4} um \d{2}:\d{2}$/ THEN RETURN true
  END IF
  RETURN false
END FUNCTION
```

### Examples

- **Redundant Kurzfassung**: A notice with `description: "<p>Hochwasser erwartet</p>"` renders the description twice — once via `{{ content }}` in the default layout producing an `h3` "Kurzfassung" + `p` element, and again via the `notice-detail-content.html` include's `h2` "Kurzfassung" + description div. Expected: only the single `h2` + description div from the include.

- **Extraneous Gewässerereignisse**: The notice-icon-div renders `{% t event_notices.title %}` which outputs "Gewässerereignisse" as a standalone text label. This appears as an unintended breadcrumb-like element. Expected: the notice-icon-div should show only the notice type badge without the collection-level "Gewässerereignisse" label acting as a breadcrumb.

- **Incorrect start date format**: A notice with `startDate: "2025-03-01"` renders as `01.03.2025` (DD.MM.YYYY via `localized_date`). Expected: `2025-03-01` (YYYY-MM-DD per design system).

- **Incorrect updated timestamp format**: A notice with `updatedAt: "2025-05-10T14:30:00Z"` renders as `10.05.2025` (DD.MM.YYYY via `localized_date`, losing the time component). Expected: `10. Mai 2025 um 14:30` (dd. MMMM YYYY um HH:MM per design system).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Non-notice pages (spots, waterways, obstacles, static pages) must continue to use the existing `<title>` format `[Page Title] | Paddel Buch`
- Non-notice pages must continue to display their content structure unchanged, including any summary sections
- Mobile navigation hamburger menu must continue to function via `#main-navbar` collapse target on all pages
- Non-notice pages must continue to display their navigation links and breadcrumbs as currently configured
- Non-notice pages must continue to display the header with `$swisscanoe-blue` (`#1b1e43`) background color
- Non-notice pages must continue to use the existing `localized_date` filter formatting for dates
- Notice page maps must continue to display Leaflet maps with affected area geometry, zoom controls, and all data layers
- Notice page details panels must continue to display the notice type badge, title, waterway links, and description content

**Scope:**
All inputs that do NOT involve notice page rendering should be completely unaffected by this fix. This includes:
- Spot detail pages (`_layouts/spot.html`)
- Waterway detail pages (`_layouts/waterway.html`)
- Obstacle detail pages (`_layouts/obstacle.html`)
- Static pages (`_layouts/page.html`)
- The home page and list pages
- The `localized_date` filter behavior for non-notice contexts

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely causes are:

1. **Redundant Kurzfassung — `{{ content }}` rendering in layout chain**: The `notice.html` layout uses `layout: default`, and `default.html` renders `{{ content }}`. The `CollectionGenerator` creates virtual `Jekyll::Document` objects but does not explicitly set `doc.content = ''`. If the description field or any other data leaks into the document body, Jekyll renders it as `{{ content }}` in the layout chain, producing redundant heading and paragraph elements. Additionally, the `notice-detail-content.html` include explicitly renders the description under an `h2` "Kurzfassung" heading, creating duplication.

2. **Extraneous Gewässerereignisse label — notice-icon-div text**: In `_layouts/notice.html`, the notice-icon-div contains `<span>{% t event_notices.title %}</span>` which renders "Gewässerereignisse". This was likely intended as a type indicator (similar to how spot pages show the spot type name), but on notice pages it appears as an extraneous breadcrumb/navigation element since it's the collection title rather than a notice-specific type. The fix should either remove this label or replace it with appropriate notice-type-specific content.

3. **Date formatting — wrong filter/format used**: The `notice-detail-content.html` include uses `{{ notice.startDate | localized_date }}` for all date fields. The `localized_date` filter defaults to `DD.MM.YYYY` format (German locale), but the design system requires:
   - Start dates: `YYYY-MM-DD` (ISO format) — the `localized_date` filter supports this via the `'iso'` format_type parameter
   - Updated timestamps: `dd. MMMM YYYY um HH:MM` — this requires the `localized_datetime` filter with `'long'` format_type, but the current `long` datetime format is `'%d. %B %Y, %H:%M Uhr'` which uses "Uhr" instead of "um" and has a comma

## Correctness Properties

Property 1: Bug Condition - Notice Page Content Structure

_For any_ notice page where the bug condition holds (the page belongs to the notices collection and uses the notice layout), the rendered HTML SHALL contain exactly one summary/description section (no redundant `h3` or `p` elements for Kurzfassung), SHALL NOT contain extraneous "Gewässerereignisse" breadcrumb/navigation text outside the intended context, and SHALL format start dates as `YYYY-MM-DD` and updated timestamps as `dd. MMMM YYYY um HH:MM`.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Notice Page Behavior

_For any_ page that is NOT a notice page (spots, waterways, obstacles, static pages), the rendered output SHALL be identical to the output before the fix, preserving all existing content structure, navigation links, breadcrumbs, date formatting, header styling, and mobile navigation functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `_includes/notice-detail-content.html`

**Specific Changes**:
1. **Remove or rework the Kurzfassung heading**: If the description section's `h2` "Kurzfassung" heading is the only intended rendering, ensure no duplicate exists. If the redundancy comes from `{{ content }}` in the layout chain, the fix is in the layout file instead.

2. **Fix start date formatting**: Change `{{ notice.startDate | localized_date }}` to `{{ notice.startDate | localized_date: 'iso' }}` to produce `YYYY-MM-DD` format.

3. **Fix updated timestamp formatting**: Change `{{ notice.updatedAt | localized_date }}` to use `localized_datetime` with a format that produces `dd. MMMM YYYY um HH:MM`. This may require adding a new format type to the `locale_filter.rb` plugin or adjusting the existing `'long'` datetime format.

**File**: `_layouts/notice.html`

**Specific Changes**:
4. **Remove extraneous Gewässerereignisse label**: Remove or replace the `<span>{% t event_notices.title %}</span>` in the notice-icon-div that renders the "Gewässerereignisse" text as an unintended breadcrumb element.

5. **Suppress redundant content rendering**: If the `{{ content }}` block in `default.html` is rendering notice description as body content, either ensure the collection generator sets empty content for notice documents, or wrap the notice layout content so that `{{ content }}` does not produce duplicate elements. One approach: the notice layout already provides all content via its own template, so any `{{ content }}` from the document body should be suppressed or the document body should be empty.

**File**: `_plugins/locale_filter.rb`

**Specific Changes**:
6. **Add notice-specific datetime format**: Add a new format type (e.g., `'notice_updated'`) to the `get_datetime_format` method that produces `dd. MMMM YYYY um HH:MM` format string `'%d. %B %Y um %H:%M'` for German locale and an appropriate equivalent for English locale.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the three bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render notice detail page HTML (or simulate the Liquid template output) and assert the expected content structure and date formats. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Redundant Kurzfassung Test**: Render a notice page with a description and count the number of summary/Kurzfassung headings — expect exactly 1 but unfixed code may produce 2 (will fail on unfixed code)
2. **Extraneous Gewässerereignisse Test**: Render a notice page and check for standalone "Gewässerereignisse" text in the details panel outside the notice type badge context (will fail on unfixed code)
3. **Start Date Format Test**: Render a notice with `startDate: "2025-03-01"` and assert the output contains `2025-03-01` — unfixed code produces `01.03.2025` (will fail on unfixed code)
4. **Updated Timestamp Format Test**: Render a notice with `updatedAt: "2025-05-10T14:30:00Z"` and assert the output contains `10. Mai 2025 um 14:30` — unfixed code produces `10.05.2025` (will fail on unfixed code)

**Expected Counterexamples**:
- Multiple Kurzfassung headings found in rendered HTML (h2 + h3 or duplicate h2)
- "Gewässerereignisse" text present as standalone label in details panel
- Start date rendered as `DD.MM.YYYY` instead of `YYYY-MM-DD`
- Updated timestamp rendered as `DD.MM.YYYY` without time component instead of `dd. MMMM YYYY um HH:MM`
- Possible causes: `{{ content }}` rendering document body, `{% t event_notices.title %}` in notice-icon-div, wrong `localized_date` filter format parameter

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed templates produce the expected behavior.

**Pseudocode:**
```
FOR ALL notice WHERE isBugCondition(notice) DO
  html := renderNoticePage_fixed(notice)
  ASSERT countElements(html, 'Kurzfassung headings') <= 1
  ASSERT NOT containsExtraneousBreadcrumb(html, 'Gewässerereignisse')
  IF notice.startDate EXISTS THEN
    ASSERT startDateFormat(html) matches /^\d{4}-\d{2}-\d{2}$/
  END IF
  IF notice.updatedAt EXISTS THEN
    ASSERT updatedFormat(html) matches /^\d{2}\. \w+ \d{4} um \d{2}:\d{2}$/
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL page WHERE NOT isBugCondition(page) DO
  ASSERT renderPage_original(page) = renderPage_fixed(page)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various page types, date values, locales)
- It catches edge cases that manual unit tests might miss (e.g., empty dates, unusual characters)
- It provides strong guarantees that behavior is unchanged for all non-notice pages

**Test Plan**: Observe behavior on UNFIXED code first for non-notice pages and notice map/details panel, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Spot Page Preservation**: Verify spot detail pages render identically before and after fix — content structure, date formatting, navigation all unchanged
2. **Obstacle Page Preservation**: Verify obstacle detail pages render identically before and after fix
3. **Waterway Page Preservation**: Verify waterway detail pages render identically before and after fix
4. **Notice Map Preservation**: Verify the Leaflet map on notice pages continues to render with affected area geometry, zoom controls, and data layers
5. **Notice Details Panel Preservation**: Verify the notice type badge, title, waterway links, and description content continue to render correctly
6. **Date Filter Preservation**: Verify the `localized_date` filter continues to produce correct output for non-notice contexts

### Unit Tests

- Test `localized_date` filter with `'iso'` format type produces `YYYY-MM-DD`
- Test new datetime format (e.g., `'notice_updated'`) produces `dd. MMMM YYYY um HH:MM`
- Test notice-detail-content.html renders exactly one description section
- Test notice layout does not render extraneous Gewässerereignisse breadcrumb
- Test edge cases: missing dates, empty description, missing updatedAt

### Property-Based Tests

- Generate random notice data (dates, descriptions, locales) and verify the fixed notice-detail-content produces correct date formats and single description section
- Generate random non-notice page data and verify the `localized_date` filter output is unchanged
- Generate random notice data and verify map and details panel elements are preserved

### Integration Tests

- Build a full notice page with Jekyll and verify the rendered HTML has correct content structure
- Build a full spot page with Jekyll and verify it is unchanged after the fix
- Test the notice page with both `de` and `en` locales to verify locale-specific date formatting
