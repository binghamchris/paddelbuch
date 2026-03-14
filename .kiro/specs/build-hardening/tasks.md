# Implementation Tasks

## Task 1: Add pagination to Contentful entry fetching

- [x] Replace the `fetch_entries` method in `_plugins/contentful_fetcher.rb` with a pagination loop that uses `limit` and `skip` parameters to fetch all entries across multiple requests
- [x] Add a `PAGE_SIZE = 1000` constant to the `ContentfulFetcher` class
- [x] The loop should concatenate results from each page and break when a page returns fewer entries than `PAGE_SIZE`
- [x] Verify the existing log line in `fetch_and_write_content` still reports the correct total entry count after pagination

### Requirements References
- Requirement 1: Acceptance Criteria 1, 2, 3, 4, 5, 6

### Files to Modify
- `_plugins/contentful_fetcher.rb`

## Task 2: Add HTML sanitization to rich text renderer

- [x] Add `require 'uri'` to the top of `_plugins/contentful_mappers.rb`
- [x] Add a `SAFE_URI_SCHEMES = %w[http https mailto tel].freeze` constant to `ContentfulMappers`
- [x] Add an `html_escape(text)` module method that escapes `&`, `<`, `>`, `"`, and `'`
- [x] Add a `safe_uri?(uri)` module method that parses the URI and checks its scheme against `SAFE_URI_SCHEMES`, returning `false` for invalid URIs or disallowed schemes
- [x] Modify the `text` case in `render_rich_text` to call `html_escape` on `node_value` before applying mark tags
- [x] Modify the `hyperlink` case in `render_rich_text` to validate the URI with `safe_uri?` — render as `<a href="...">` with escaped URI if safe, or `<span>` if unsafe

### Requirements References
- Requirement 2: Acceptance Criteria 1, 2, 3, 4, 5, 6

### Files to Modify
- `_plugins/contentful_mappers.rb`

## Task 3: Add version guards to ssl_patch.rb

- [x] Wrap the existing patch body in a guard that checks `defined?(HTTP::Connection) && HTTP::Connection.method_defined?(:start_tls)` before calling `alias_method`
- [x] Add a gem version check using `Gem.loaded_specs['http']` — log a warning via `Jekyll.logger.warn` if the version does not start with `5.`
- [x] Log a warning and skip the patch if `HTTP::Connection#start_tls` is not found
- [x] Add a comment at the top documenting the target `http` gem version (~> 5.x) and the Ruby/OpenSSL versions the patch addresses

### Requirements References
- Requirement 3: Acceptance Criteria 1, 2, 7

### Files to Modify
- `_plugins/ssl_patch.rb`

## Task 4: Add version guard to i18n_patch.rb

- [x] Before the `Jekyll::Hooks.register` block, read the gem version via `Gem.loaded_specs['jekyll-multiple-languages-plugin']`
- [x] Inside the hook, check if the version starts with `1.8` — if not, log a warning via `Jekyll.logger.warn` and skip the patch (set `I18nPatch.patched!` and `next`)
- [x] Add a comment at the top documenting the target `jekyll-multiple-languages-plugin` version (1.8.x) and the Ruby version (3.4+) the patch addresses

### Requirements References
- Requirement 3: Acceptance Criteria 3, 4, 8

### Files to Modify
- `_plugins/i18n_patch.rb`

## Task 5: Add version guard to build_timer.rb

- [x] Inside `BuildTimerSiteExtension`, wrap the `process_org` method definition in a conditional: `if Jekyll::Site.method_defined?(:process_org)`
- [x] In the `else` branch, log a warning via `Jekyll.logger.warn` that `process_org` was not found and per-language generator timing is skipped
- [x] Add a comment above `BuildTimerSiteExtension` documenting the dependency on `jekyll-multiple-languages-plugin` providing `process_org`

### Requirements References
- Requirement 3: Acceptance Criteria 5, 6, 9

### Files to Modify
- `_plugins/build_timer.rb`

## Task 6: Add dependency vulnerability scanning

- [x] Add `gem "bundler-audit", "~> 0.9"` to the development group in `Gemfile`
- [x] Run `bundle install` to update `Gemfile.lock`
- [x] Add Rake tasks to `Rakefile`: `audit` (alias for `audit:ruby`), `audit:ruby` (runs `bundle-audit check --update`), `audit:npm` (runs `npm audit --audit-level=moderate`), and `audit:all` (runs both sequentially)
- [x] Each task should print a confirmation message on success and call `abort` with a descriptive message on failure
- [x] Add a "Vulnerability Scanning" section to `README.md` documenting `bundle exec rake audit` and `bundle exec rake audit:all`

### Requirements References
- Requirement 4: Acceptance Criteria 1, 2, 3, 4, 5, 6, 7

### Files to Modify
- `Gemfile`
- `Gemfile.lock` (via `bundle install`)
- `Rakefile`
- `README.md`