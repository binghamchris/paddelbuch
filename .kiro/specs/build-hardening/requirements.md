# Requirements Document

## Introduction

This specification addresses four maintenance, stability, and security gaps identified during a code review of the Paddelbuch Jekyll project. The issues span silent data truncation in the Contentful API fetcher, an XSS surface in the rich text HTML renderer, fragile monkey-patches that break on dependency upgrades, and the absence of automated dependency vulnerability scanning. Together these hardening measures improve the reliability and security posture of the build pipeline without changing user-facing functionality.

## Glossary

- **Contentful_Fetcher**: The custom Jekyll Generator plugin (`_plugins/contentful_fetcher.rb`) that fetches content from Contentful CMS at build time
- **Rich_Text_Renderer**: The `render_rich_text` method in `ContentfulMappers` (`_plugins/contentful_mappers.rb`) that converts Contentful rich text nodes into HTML strings
- **Monkey_Patch**: A runtime modification to an external library's class or method, applied in `_plugins/ssl_patch.rb`, `_plugins/i18n_patch.rb`, and `_plugins/build_timer.rb`
- **SSL_Patch**: The monkey-patch in `_plugins/ssl_patch.rb` that overrides `HTTP::Connection#start_tls` for Ruby 3.4+/OpenSSL 3.x CRL compatibility
- **I18n_Patch**: The monkey-patch in `_plugins/i18n_patch.rb` that fixes `TranslatedString#initialize` for Ruby 3.4 compatibility with `jekyll-multiple-languages-plugin` v1.8.0
- **Build_Timer_Patch**: The monkey-patch in `_plugins/build_timer.rb` that wraps `Jekyll::Site#process` and `#process_org` via `prepend` for build timing instrumentation
- **Vulnerability_Scanner**: A tool or script that checks project dependencies against known CVE databases (e.g., `bundler-audit` for Ruby gems, `npm audit` for Node.js packages)
- **Pagination**: The technique of fetching API results across multiple requests using `skip` and `limit` parameters when the total result count exceeds a single request's maximum
- **URI_Allowlist**: A set of permitted URI schemes (http, https, mailto, tel) used to validate hyperlink targets in rendered HTML

## Requirements

### Requirement 1: Paginated Contentful Entry Fetching

**User Story:** As a site maintainer, I want all Contentful entries fetched regardless of collection size, so that content is never silently truncated when a content type exceeds 1000 entries.

#### Acceptance Criteria

1. WHEN fetching entries for a Content_Type, THE Contentful_Fetcher SHALL request entries in pages of up to 1000 using the Contentful `limit` and `skip` parameters
2. WHEN a Content_Type has more entries than the page limit, THE Contentful_Fetcher SHALL issue additional requests with incrementing `skip` values until all entries are retrieved
3. WHEN all pages are fetched, THE Contentful_Fetcher SHALL combine entries from all pages into a single collection for that Content_Type
4. THE Contentful_Fetcher SHALL log the total number of entries fetched per Content_Type after pagination completes
5. FOR ALL Content_Types with N total entries, the paginated fetch SHALL return exactly N entries (completeness property)
6. FOR ALL Content_Types, fetching with pagination SHALL produce the same entries as a hypothetical single request with no limit (equivalence property)

### Requirement 2: Rich Text HTML Sanitization

**User Story:** As a site maintainer, I want rendered HTML from Contentful rich text to be safe from XSS attacks, so that compromised or malicious CMS content cannot inject scripts into the site.

#### Acceptance Criteria

1. WHEN rendering a `hyperlink` node, THE Rich_Text_Renderer SHALL validate the URI scheme against the URI_Allowlist (http, https, mailto, tel)
2. WHEN a `hyperlink` node contains a URI with a scheme not in the URI_Allowlist, THE Rich_Text_Renderer SHALL omit the `href` attribute and render the link text as plain text wrapped in a `<span>` element
3. WHEN rendering a `text` node, THE Rich_Text_Renderer SHALL HTML-escape the text content (escaping `&`, `<`, `>`, `"`, and `'`) before applying mark tags
4. WHEN rendering a `hyperlink` node with a valid URI, THE Rich_Text_Renderer SHALL HTML-escape the URI value in the `href` attribute
5. FOR ALL text content strings, the rendered HTML SHALL contain no unescaped `<`, `>`, `&`, `"`, or `'` characters outside of the renderer's own structural tags (sanitization property)
6. FOR ALL hyperlink URIs, the rendered `href` attribute SHALL contain only URIs with schemes from the URI_Allowlist or SHALL be absent (scheme safety property)

### Requirement 3: Monkey-Patch Version Guards

**User Story:** As a developer, I want monkey-patches to validate the target gem version and method existence before applying, so that dependency upgrades do not cause silent breakage or cryptic errors.

#### Acceptance Criteria

1. WHEN the SSL_Patch loads, THE SSL_Patch SHALL verify that the `http` gem is available and that `HTTP::Connection` defines the `start_tls` method before applying the alias
2. IF the `http` gem version does not match the expected major version, THEN THE SSL_Patch SHALL log a warning indicating the version mismatch and the expected version
3. WHEN the I18n_Patch loads, THE I18n_Patch SHALL verify that `jekyll-multiple-languages-plugin` is version 1.8.x before patching `TranslatedString#initialize`
4. IF the `jekyll-multiple-languages-plugin` version is not 1.8.x, THEN THE I18n_Patch SHALL log a warning and skip the patch
5. WHEN the Build_Timer_Patch loads, THE Build_Timer_Patch SHALL verify that `Jekyll::Site` defines `process_org` (provided by the i18n plugin) before wrapping it
6. IF `Jekyll::Site` does not define `process_org`, THEN THE Build_Timer_Patch SHALL log a warning and skip the `process_org` instrumentation while still applying the `process` wrapper
7. THE SSL_Patch SHALL include a comment documenting the target `http` gem version and the Ruby/OpenSSL versions the patch addresses
8. THE I18n_Patch SHALL include a comment documenting the target `jekyll-multiple-languages-plugin` version and the Ruby version the patch addresses
9. THE Build_Timer_Patch SHALL include a comment documenting the dependency on `jekyll-multiple-languages-plugin` providing `process_org`

### Requirement 4: Dependency Vulnerability Scanning

**User Story:** As a developer, I want automated dependency vulnerability scanning for both Ruby and Node.js dependencies, so that known CVEs are detected before deployment.

#### Acceptance Criteria

1. THE Gemfile SHALL include the `bundler-audit` gem in the development group
2. THE project SHALL provide a Rake task named `audit` that runs `bundle-audit check --update` to scan Ruby gems for known vulnerabilities
3. WHEN the `audit` Rake task detects vulnerabilities, THE task SHALL exit with a non-zero status code
4. WHEN the `audit` Rake task detects no vulnerabilities, THE task SHALL exit with a zero status code and print a confirmation message
5. THE project SHALL provide a Rake task named `audit:all` that runs both `bundle-audit check --update` and `npm audit --audit-level=moderate` sequentially
6. WHEN either audit in the `audit:all` task fails, THE task SHALL report which audit failed and exit with a non-zero status code
7. THE README SHALL document how to run vulnerability checks using the Rake tasks

