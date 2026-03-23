---
inclusion: fileMatch
fileMatchPattern: ["_includes/**/*.html", "_layouts/**/*.html"]
---

# Internationalisation (i18n) Requirements

Paddel Buch supports German (default, `de`) and English (`en`). Every user-facing string must be translated in both locales.

## Translation Workflow

1. Add the German string to `_i18n/de.yml`
2. Add the English string to `_i18n/en.yml`
3. Use `{% t key.path %}` in Liquid templates to reference the string

Both files must have matching key structures. Missing keys in either file will cause untranslated text to appear.

## Translation File Structure

Keys are organised by domain (nav, labels, actions, etc.):

```yaml
# _i18n/de.yml
nav:
  spots: "Einstiegsorte"
labels:
  more_details: "Weitere Details"
```

```yaml
# _i18n/en.yml
nav:
  spots: "Spots"
labels:
  more_details: "More details"
```

## Date Formatting

Use the `localized_date` and `localized_datetime` Liquid filters from `locale_filter.rb`. Never hardcode date formats — German uses `DD.MM.YYYY`, English uses `DD/MM/YYYY`.

## Key Rules

- Never hardcode user-visible text in HTML — always use `{% t key.path %}`
- Always add keys to both `_i18n/de.yml` and `_i18n/en.yml` simultaneously
- German is the default locale — if a key is missing in English, the German value does not fall back automatically in templates
- Map accessibility labels (`map.spot_map_label`, etc.) must also be translated
- Test changes in both locales: the site builds separately for `/` (German) and `/en/` (English)
