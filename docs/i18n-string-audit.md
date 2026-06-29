# i18n Hardcoded-String Audit

Status: audit complete (quality-and-tooling-hardening, Task 4.4 / Requirements 5.3, 5.5)

This document catalogues every location where user-facing strings are held as parallel
`de`/`en` literals **outside** the `_i18n/*.yml` translation files, and records the
decision for each (consolidate vs. keep-with-rationale).

The **guaranteed** i18n deliverable of this work is the automated key-parity test
(`spec/i18n_key_parity_spec.rb`), which fails if `_i18n/de.yml` and `_i18n/en.yml`
ever diverge in their key paths (Requirements 5.1, 5.2). String consolidation below is
best-effort and gated by Requirement 0 (zero user-facing change).

## Why these literals exist outside `_i18n`

1. **Client-side popup modules are not localised.** `assets/` is listed in
   `exclude_from_localizations` (`_config.yml`), so a single copy of each
   `assets/js/*-popup.js` file is served to both the German (`/`) and English (`/en/`)
   site trees. Under the strict CSP (`script-src 'self' …`, no inline JS) the module
   must therefore carry **both** locales' strings and select at runtime using the
   `currentLocale` passed in. There is no per-locale copy to inject a single language
   into.

2. **Build-time precompute labels** (`precompute_generator.rb`) are emitted into a
   CSP-safe `<script type="application/json">` block per page. These *could* read from
   `_i18n` at build time, but several of the labels deliberately differ in wording from
   the nearest `_i18n` entry (see below), so sourcing them from `_i18n` would change the
   rendered output.

## Catalogue

### `assets/js/spot-popup.js`
- `spotTypeNames` — slug -> `{de, en}` category labels (e.g. `Ein- und Ausstieg` /
  `Entry and Exit`).
- `paddleCraftTypeNames` — slug -> `{de, en}` craft labels.
- `getLabels(locale)` — popup field labels (`GPS`, `Approx. Address`/`Ungefähre Adresse`,
  `Navigate To`/`Navigieren zu`, `More details`/`Weitere Details`, copy tooltips, ...).
- `generateRejectedSpotPopupContent` — `No Entry Spot`/`Kein Zutritt Ort` and the icon
  `alt` text.

Decision: **Keep.** These render in the browser popup HTML, which Task 5 / Property 4
pins byte-for-byte against the baseline. The category wording (`Entry and Exit`) differs
from both `_i18n` (`Entry & Exit Spots`) and the filter-panel labels, so re-sourcing them
would change popup text (Requirement 0). Not localisable per file (see reason 1).

### `assets/js/obstacle-popup.js`
- `strings.{de,en}` — `Umtragen möglich`/`Portage possible`, `Ja`/`Yes`, `Nein`/`No`,
  `Unbekannt`/`Unknown`, `Weitere Details`/`More details`.

Decision: **Keep.** Client-side popup HTML (reason 1); gated by Property 4.

### `assets/js/event-notice-popup.js`
- `strings.{de,en}` — `Ungefähres Startdatum`/`Approx. Start Date`,
  `Ungefähres Enddatum`/`Approx. End Date`, `Weitere Details`/`More details`.

Decision: **Keep.** Client-side popup HTML (reason 1); gated by Property 4.

### `_plugins/precompute_generator.rb`
- `spot_type_options` — `de`/`en` filter labels per spot-type slug. These currently match
  `_i18n` `spot_types.*` **exactly** for both locales.
- `layer_labels` — `No Entry Spots`/`Keine Zutritt Orte`, `Event Notices`/`Gewässerereignisse`,
  `Obstacles`/`Hindernisse`, `Protected Areas`/`Schutzgebiete`.
- Dimension labels — `Spot Type`/`Ortstyp`, `Paddle Craft Type`/`Paddelboottyp`.

Decision: **Keep (deferred consolidation).** Although `spot_type_options` happens to match
`_i18n` `spot_types` today, the other labels (`layer_labels`, dimension labels) have no
matching `_i18n` keys, and consolidating only part of the block would split one config
across two sources. A full consolidation would require adding a slug->i18n-key map and a
YAML loader to this generator and verifying every label is byte-identical to `_i18n`
(Requirement 0). That is disproportionate to the benefit here, and the single-source
guarantee that matters most — that `_i18n/de.yml` and `_i18n/en.yml` never drift — is
already enforced by `spec/i18n_key_parity_spec.rb`. Recorded as rationale per
Requirement 5.5.

## Summary

| Location | Strings | Decision |
|---|---|---|
| `spot-popup.js` | type/craft/field labels | Keep (client-side, wording differs, Property 4) |
| `obstacle-popup.js` | portage labels | Keep (client-side) |
| `event-notice-popup.js` | date labels | Keep (client-side) |
| `precompute_generator.rb` | filter/layer/dimension labels | Keep (deferred; mixed `_i18n` coverage) |

No string literals were re-sourced, so no rendered user-facing text changes (Requirement 0).
The enforceable invariant (key parity between the two `_i18n` files) is covered by the new test.
