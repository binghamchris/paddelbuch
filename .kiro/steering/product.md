# Product Overview

Paddel Buch (paddelbuch.ch) is a bilingual (German/English) static website that displays Swiss paddle sports data on interactive maps. Content is managed in Contentful (headless CMS) and rendered as a Jekyll static site hosted on AWS Amplify.

## Domain

- Spots: launch/access points for paddlers
- Waterways: rivers and lakes with geometry data
- Obstacles: hazards on waterways
- Notices: time-bound event notices for waterways
- Protected areas: nature reserves and restricted zones
- Static pages: CMS-driven informational pages

## Audience

Swiss paddle sports community — kayakers, canoeists, SUP paddlers — planning trips and exploring waterways.

## Key Capabilities

- Interactive Leaflet/MapLibre maps with filterable data layers
- Detail pages for every spot, waterway, obstacle, and notice
- JSON API at `/api/` for open data consumers
- Incremental Contentful sync (delta merge) for fast builds
- Parallel locale builds (de + en) merged into a single `_site/`
- Spatial tile generation for map clustering

## Languages

German is the default locale. English is the secondary locale served under `/en/`. All user-facing strings must exist in both `_i18n/de.yml` and `_i18n/en.yml`.
