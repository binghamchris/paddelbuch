# Missing Homepage Bugfix Tasks

## Tasks

- [x] 1. Create the homepage file
  - [x] 1.1 Create `index.html` in the project root with front matter: `layout: default`, `pageName: home`, `permalink: /`
  - [x] 1.2 Add the map include (`{% include map-init.html %}`) as the page body content
- [x] 2. Verify the fix
  - [x] 2.1 Build the site with Jekyll and confirm `_site/index.html` is generated
  - [x] 2.2 Verify the generated `_site/index.html` contains the `page-home` body class, map container, and Switzerland coordinates (46.801111, 8.226667)
  - [x] 2.3 Verify existing pages (`_site/404.html`, `_site/gewaesser/seen/index.html`, `_site/gewaesser/fluesse/index.html`) are still generated correctly
  - [x] 2.4 Verify the English locale homepage is generated at `_site/en/index.html`
