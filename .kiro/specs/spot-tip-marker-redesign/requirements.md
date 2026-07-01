# Requirements Document

## Introduction

The `spot-tips` feature added **Modifier_Icons** to map markers so users can see, at a glance, which spots carry advisory tips. As originally built (see `spot-tips` Requirement 4), each tip is drawn as a small **circular badge** floating at a corner of the marker, layered on top of the base marker `<img>` via absolutely-positioned modifier `<img>` elements.

That approach has three problems in production:

1. **Visually disconnected / obscuring** — the corner discs float away from the marker so, on a busy map, it is ambiguous which badge belongs to which pin, and the discs clip the coloured head (the marker's main content).
2. **Out-of-date artwork** — the disc glyphs (a star, a leaf-veins motif) no longer match the finalised tip banners in `assets/images/tips/` (a clean leaf for the Eco tip, a "SWISS" wordmark for the Swiss Canoe tip).
3. **CSP-non-compliant** — the modifier `<img>` elements are positioned with inline `style="position:absolute;left:…;top:…"` attributes. The deployed Content Security Policy (`style-src 'self'`, no `'unsafe-inline'`) blocks inline `style` attributes parsed from injected markup, so the offsets do not apply under the production policy.

This spec **redesigns** the map marker tip modifiers to an **open "halo"** that hugs the marker head from shoulder to shoulder over the top, leaving the neck and the head's spot-type glyph fully visible, with colour-coded **beads** on the halo carrying the tip glyphs. The visual design was iterated with the maintainer and the approved result is captured in the reference mockup at `.kiro/specs/spot-tip-marker-redesign/reference/marker-modifier-mockups.html` (the `m-opt3b*` markers and the `g-leaf-*` / `g-cross-*` glyph symbols). This spec is the source of truth for behaviour; that mockup is the source of truth for exact geometry, sizing, and colour.

### Relationship to the `spot-tips` spec

This spec **supersedes `spot-tips` Requirement 4 (4.1–4.7)** — the map marker Modifier_Icon behaviour and the `TIP_MODIFIER_CONFIG` shape are redefined here. All other `spot-tips` requirements (Contentful integration, filter panel, tip banners on the detail page, API, data availability, precomputation, documentation) are **unchanged** and out of scope. In particular, the tip **banners** on the spot detail page (`_includes/spot-tip-banners.html`, `assets/images/tips/tip-banner-{slug}.svg`) are a separate concern and are **not** modified by this spec.

## Glossary

- **Map_Marker**: A Leaflet marker representing a Spot, styled with an SVG icon based on spot type. Anchored at the pin tip (the precise geographic point).
- **Base_Marker_Icon**: The teardrop pin SVG for a spot type (e.g. `assets/images/markers/startingspots-entryexit.svg`), authored in a `0 0 52 84` viewBox and rendered on the map at ~32×53 px, anchored at the tip `[16, 53]`.
- **Pin_Head**: The circular upper part of the Base_Marker_Icon that contains the white spot-type glyph (arrows / rest bars / emergency symbol). This is the marker's **main content** and must never be covered.
- **Pin_Neck**: The empty tapered lower part of the Base_Marker_Icon between the head and the tip. Carries no unique information.
- **Modifier_Icon**: The visual indicator, composited onto a Map_Marker, that a spot has a given Spot_Tip_Type. In this redesign a Modifier_Icon is a **Bead** sitting on the **Halo**, not a floating corner disc.
- **Halo**: An open arc (horseshoe) drawn around the Pin_Head, hugging it from the left neck-shoulder, over the top, to the right neck-shoulder. Open at the bottom so it never crosses the Pin_Neck.
- **Bead**: A small white circle with a coloured stroke, seated on the Halo, containing a **Tip_Glyph**. One Bead per applicable Spot_Tip_Type.
- **Tip_Glyph**: The per-tip artwork rendered inside a Bead (a green leaf for the Eco tip; a navy cross for the Swiss Canoe tip), sourced from `assets/images/markers/tip-modifier-{slug}.svg`.
- **Composite_Icon**: The Leaflet `DivIcon` produced for a spot that has one or more tips — a single inline `<svg>` containing the Base_Marker_Icon, the Halo, the Bead(s), and the Tip_Glyph(s).
- **TIP_MODIFIER_CONFIG**: The single authoritative client-side configuration object (in `assets/js/marker-styles.js`) mapping each Spot_Tip_Type slug to its Tip_Glyph asset and colour.
- **PaddelbuchColors**: The client-side colour palette (`window.PaddelbuchColors`, populated by `assets/js/color-vars.js` from the CSP-safe `#paddelbuch-colors` JSON block, which derives from `_sass/settings/_paddelbuch_colours.scss`).
- **Reference_Mockup**: `.kiro/specs/spot-tip-marker-redesign/reference/marker-modifier-mockups.html` — the approved static visual specification of the halo design, committed alongside this spec so it travels with it. It is a standalone HTML file (open it directly in a browser) and lives under `.kiro/`, which Jekyll does not build. It is a visual aid only — every geometry/colour constant needed for implementation is transcribed into `design.md`, so the implementation does not depend on opening it.

## Requirements

### Requirement 1: Halo-based Modifier rendering

**User Story:** As a map user, I want tip indicators that are clearly attached to their marker and never hide the marker's icon, so that I can tell at a glance which spot has which tips without confusion.

#### Acceptance Criteria

1. WHEN a non-rejected Spot has one or more Spot_Tips that have a TIP_MODIFIER_CONFIG entry, THE Map_Marker SHALL render a Composite_Icon consisting of the Base_Marker_Icon plus a Halo with one Bead per applicable Spot_Tip_Type.
2. WHEN a Halo is rendered, THE Halo SHALL be an open arc that hugs the Pin_Head from the left neck-shoulder, over the top, to the right neck-shoulder, and SHALL be open at the bottom so that it does not cross the Pin_Neck.
3. WHEN a Composite_Icon is rendered, THE Composite_Icon SHALL NOT cover any part of the Pin_Head's spot-type glyph, and SHALL NOT cover the Pin_Neck.
4. THE Halo, Beads, and Tip_Glyphs SHALL reproduce the geometry, sizing, and layering shown in the Reference_Mockup (`m-opt3b`, `m-opt3b-1tip`, `m-opt3b-rest`).
5. WHEN a Spot has exactly one applicable Spot_Tip_Type, THE Composite_Icon SHALL render a single Bead at the top-centre of the Halo, and the Halo SHALL be drawn in that tip's colour.
6. WHEN a Spot has exactly two applicable Spot_Tip_Types, THE Composite_Icon SHALL render one Bead at the upper-left and one at the upper-right of the Halo, and the Halo SHALL be split into two segments, each drawn in the colour of the tip whose Bead sits on that segment.
7. WHEN a Spot has zero Spot_Tips, THE Map_Marker SHALL render the standard Base_Marker_Icon with no Halo, Beads, or Tip_Glyphs (existing behaviour, unchanged).
8. WHEN a Spot is rejected, THE Map_Marker SHALL render the no-entry icon with no Modifier_Icons (existing behaviour, unchanged).
9. THE Composite_Icon SHALL remain anchored at the pin tip so the marker points at the exact geographic location, and the Base_Marker_Icon SHALL render at the same on-screen size as a standard (no-tip) marker.
10. WHEN a Composite_Icon is clicked, THE popup SHALL open in the same relative position as for a standard marker (just above the marker), preserving the existing marker-click and popup behaviour.

### Requirement 2: Tip glyph artwork matching the final banners

**User Story:** As a site maintainer, I want the map tip glyphs to match the finalised tip banners, so that the map and the detail page present a consistent visual language.

#### Acceptance Criteria

1. THE Eco tip Tip_Glyph SHALL be the leaf mark taken from the visible artwork of `assets/images/tips/tip-banner-swiss-canoe-eco-tip.svg`, filled in `$green-1` (`#07753f`).
2. THE Swiss Canoe tip Tip_Glyph SHALL be the cross mark taken from the corner of `assets/images/tips/tip-banner-swiss-canoe-tip.svg`, filled in `$swisscanoe-blue` (`#1b1e43`).
3. Each Tip_Glyph SHALL be stored at `assets/images/markers/tip-modifier-{slug}.svg` (the existing naming convention), containing the glyph only on a transparent background — it SHALL NOT contain the disc/badge shape (the Bead is drawn by the Composite_Icon).
4. WHEN authoring the Eco leaf glyph asset, only the visible leaf path SHALL be included; any hidden, zero-opacity, or embedded raster layers present in the source banner SHALL be excluded.
5. Each Tip_Glyph SHALL be framed within the Bead with a clear margin between the glyph and the Bead border, reproducing the sizing approved in the Reference_Mockup (the leaf occupies ~80% of its placement box; the cross is framed as shown in the mockup).

### Requirement 3: Content Security Policy compliance

**User Story:** As a developer, I want the marker compositing to work under the site's strict CSP, so that tip indicators render correctly in production.

#### Acceptance Criteria

1. THE Composite_Icon markup SHALL NOT contain any inline `style` attribute.
2. THE Composite_Icon SHALL position and size all of its parts (Base_Marker_Icon, Halo, Beads, Tip_Glyphs) using SVG geometry (viewBox, `x`/`y`/`width`/`height`, `cx`/`cy`/`r`, `d`) and SVG presentation attributes (`fill`, `stroke`, `stroke-width`), and/or CSS classes defined in a stylesheet — never inline `style`.
3. THE Composite_Icon SHALL reference the Base_Marker_Icon and Tip_Glyph SVGs from same-origin `/assets/…` paths, consistent with the deployed `img-src 'self'` policy.
4. THE implementation SHALL NOT introduce `eval`, `new Function`, inline `<script>`, or any construct disallowed by the deployed CSP.

### Requirement 4: Colour sourced from the palette single source of truth

**User Story:** As a maintainer, I want marker tip colours to come from the site's colour palette, so that colours stay consistent and are changed in one place.

#### Acceptance Criteria

1. THE Halo segment colour and the Bead stroke colour for each tip SHALL be that tip's colour as defined in TIP_MODIFIER_CONFIG.
2. Each tip's colour SHALL be resolved at runtime from `PaddelbuchColors` using a key that corresponds to a token in `_sass/settings/_paddelbuch_colours.scss` (the colour single source of truth): the Eco tip uses `$green-1` and the Swiss Canoe tip uses `$swisscanoe-blue`.
3. IF `PaddelbuchColors` is unavailable or does not contain the required key, THEN THE Composite_Icon SHALL fall back to a hard-coded hex value in TIP_MODIFIER_CONFIG that mirrors the corresponding palette token, so the marker still renders in the correct colour.
4. THE colour values used in the Tip_Glyph SVG assets SHALL match the corresponding palette tokens (`#07753f` for the leaf, `#1b1e43` for the cross).

### Requirement 5: Accessibility and internationalisation

**User Story:** As a user of assistive technology, I want map markers with tips to have a meaningful, localised label, so that I understand what each marker represents.

#### Acceptance Criteria

1. THE Composite_Icon SHALL expose an accessible name (e.g. via `role="img"` and `aria-label` on the root `<svg>`, or an equivalent mechanism) describing the spot and its tips.
2. THE accessible name SHALL be localised, and any new label strings SHALL be added to both `_i18n/de.yml` and `_i18n/en.yml` with matching key structures.
3. WHEN a spot has tips, THE accessible name SHALL convey that the marker is a spot with tips and SHALL include the localised name(s) of the applicable Spot_Tip_Type(s) when those names are available client-side.
4. THE accessible name SHALL be built from existing localised tip labels (e.g. from the `spotTipType` dimension config) and SHALL NOT hard-code tip names in JavaScript.
5. IF the localised Spot_Tip_Type names are not available client-side, THEN THE Composite_Icon SHALL still expose a non-empty accessible name (for example the spot name, or a generic localised "spot with tips" label), and SHALL NOT emit an empty accessible name.

### Requirement 6: Single authoritative configuration

**User Story:** As a developer, I want one place that defines each tip's glyph and colour, so that adding or changing a tip type is a single, consistent edit.

#### Acceptance Criteria

1. TIP_MODIFIER_CONFIG SHALL remain the single authoritative source that maps each Spot_Tip_Type slug to its Tip_Glyph asset URL and its colour, and it SHALL be exported via `PaddelbuchMarkerStyles.TIP_MODIFIER_CONFIG`.
2. THE per-tip position/size offset fields used by the old disc design SHALL be removed from TIP_MODIFIER_CONFIG; Bead and Halo geometry SHALL be computed from the number and order of applicable tips (not stored per tip).
3. THE Composite_Icon SHALL derive all per-tip presentation (glyph asset, colour) from TIP_MODIFIER_CONFIG, and SHALL consume no duplicate per-tip presentation data defined elsewhere.
4. IF a Spot_Tip_Type slug has no TIP_MODIFIER_CONFIG entry, THEN THE Composite_Icon SHALL omit a Bead for that slug and render the remaining applicable tips without error (graceful skip, matching the superseded Requirement 4.6 behaviour).

### Requirement 7: Tests updated to the new model

**User Story:** As a developer, I want the marker tests to reflect the new composition, so that the redesign is covered and the obsolete offset assertions are removed.

#### Acceptance Criteria

1. THE existing property test that asserts unique per-tip position offsets (`_tests/property/spot-tip-modifier-offsets.property.test.js`) SHALL be actively updated or replaced to reflect that TIP_MODIFIER_CONFIG no longer carries offsets; the configuration change in Requirement 6.2 alone SHALL NOT be treated as satisfying this criterion — the test itself must be updated.
2. THE existing composite-marker property test (`_tests/property/spot-tip-composite-marker.property.test.js`) SHALL be updated so that, for a spot with N applicable tips (N in {1, 2}), the Composite_Icon SVG contains exactly N Beads and N Tip_Glyph references with the correct asset URLs, and skips slugs with no config entry.
3. THE test suite SHALL assert that the Composite_Icon markup contains no inline `style` attribute (CSP guard).
4. THE test suite SHALL assert that the Composite_Icon exposes a non-empty accessible name.
5. All updated JavaScript tests SHALL continue to use the project's existing JS test tooling (Jest + fast-check) and directory conventions.

### Requirement 8: Documentation updates

**User Story:** As a contributor, I want the docs to describe the new marker composition, so that the implementation is discoverable and maintainable.

#### Acceptance Criteria

1. WHEN this redesign is implemented, THE Frontend document (`docs/frontend.md`) SHALL be updated to describe the SVG-based Composite_Icon in `layer-control.js`, the revised `TIP_MODIFIER_CONFIG` shape in `marker-styles.js`, and the colour sourcing via `PaddelbuchColors`.
2. WHEN this redesign changes any test files, THE Testing document (`docs/testing.md`) SHALL be updated to reflect the renamed/updated marker test files.
3. THE Reference_Mockup (`.kiro/specs/spot-tip-marker-redesign/reference/marker-modifier-mockups.html`) SHALL be referenced from `docs/frontend.md` as the visual source of truth for the marker tip design.
4. THE redesign SHALL NOT be considered complete or deployed until all documentation updates required by this requirement (8.1–8.3) are completed; incomplete documentation SHALL block the redesign's release.
