# Design Document: Build Hardening

## Overview

This design addresses four maintenance, stability, and security gaps in the Paddelbuch Jekyll project: silent data truncation from unpaginated Contentful API calls, an XSS surface in the rich text HTML renderer, fragile monkey-patches without version guards, and the absence of dependency vulnerability scanning.

All changes are surgical modifications to existing files. No new plugin classes or architectural changes are introduced.

## Architecture

The changes touch four independent areas of the codebase with no cross-dependencies between them:

```
_plugins/contentful_fetcher.rb  ← Pagination loop in fetch_entries
_plugins/contentful_mappers.rb  ← HTML escaping + URI validation in render_rich_text
_plugins/ssl_patch.rb           ← Version guard + method existence check
_plugins/i18n_patch.rb          ← Version guard for jekyll-multiple-languages-plugin
_plugins/build_timer.rb         ← Guard for process_org existence
Gemfile                         ← Add bundler-audit
Rakefile                        ← Add audit tasks
```

## Components and Interfaces

### 1. Paginated Entry Fetching

Replace the single-call `fetch_entries` in `ContentfulFetcher` with a pagination loop.

```ruby
# _plugins/contentful_fetcher.rb — replace fetch_entries method

PAGE_SIZE = 1000

def fetch_entries(content_type)
  all_entries = []
  skip = 0

  loop do
    page = client.entries(
      content_type: content_type,
      locale: '*',
      include: 2,
      limit: PAGE_SIZE,
      skip: skip
    )
    all_entries.concat(page.to_a)
    break if page.to_a.size < PAGE_SIZE

    skip += PAGE_SIZE
  end

  all_entries
end
```

The Contentful Ruby gem returns an `Array`-like object from `client.entries`. When the returned count is less than `PAGE_SIZE`, all entries have been fetched. The `skip` parameter offsets into the result set.

### 2. Rich Text HTML Sanitization

Add two helper methods to `ContentfulMappers` and modify the `render_rich_text` method's `text` and `hyperlink` handlers.

```ruby
# _plugins/contentful_mappers.rb — new constants and helpers

SAFE_URI_SCHEMES = %w[http https mailto tel].freeze

def html_escape(text)
  text.to_s
      .gsub('&', '&amp;')
      .gsub('<', '&lt;')
      .gsub('>', '&gt;')
      .gsub('"', '&quot;')
      .gsub("'", '&#39;')
end

def safe_uri?(uri)
  return false if uri.nil? || uri.strip.empty?
  scheme = URI.parse(uri).scheme&.downcase
  scheme.nil? || SAFE_URI_SCHEMES.include?(scheme)
rescue URI::InvalidURIError
  false
end
```

Modified `render_rich_text` handlers:

```ruby
when 'text'
  text = html_escape(node_value)
  # marks applied after escaping — they wrap with trusted tags only
  node_marks.each do |mark|
    tag = MARK_TAG_MAP[mark['type']]
    text = "<#{tag}>#{text}</#{tag}>" if tag
  end
  text

when 'hyperlink'
  uri = node_data.is_a?(Hash) ? node_data['uri'] : (node_data.respond_to?(:uri) ? node_data.uri : '')
  inner = render_rich_text(node_content)
  if safe_uri?(uri)
    "<a href=\"#{html_escape(uri)}\">#{inner}</a>"
  else
    "<span>#{inner}</span>"
  end
```

### 3. Monkey-Patch Version Guards

#### ssl_patch.rb

Add a method existence check before `alias_method` and a gem version warning:

```ruby
if RUBY_VERSION >= '3.4' || (defined?(OpenSSL::OPENSSL_LIBRARY_VERSION) &&
   OpenSSL::OPENSSL_LIBRARY_VERSION.start_with?('OpenSSL 3'))

  # Target: http gem ~> 5.x, addresses Ruby 3.4+ / OpenSSL 3.x CRL verification errors
  if defined?(HTTP::Connection) && HTTP::Connection.method_defined?(:start_tls)
    http_gem_version = Gem.loaded_specs['http']&.version&.to_s
    if http_gem_version && !http_gem_version.start_with?('5.')
      Jekyll.logger.warn 'SSLPatch:', "http gem version #{http_gem_version} detected, patch targets 5.x — patch may not work correctly"
    end

    # ... apply patch ...
  else
    Jekyll.logger.warn 'SSLPatch:', 'HTTP::Connection#start_tls not found — skipping SSL patch'
  end
end
```

#### i18n_patch.rb

Check the gem version before patching:

```ruby
# Target: jekyll-multiple-languages-plugin 1.8.x, addresses Ruby 3.4 String.new(nil) removal
i18n_spec = Gem.loaded_specs['jekyll-multiple-languages-plugin']
i18n_version = i18n_spec&.version&.to_s

Jekyll::Hooks.register :site, :after_init do |site|
  next if I18nPatch.patched?

  if i18n_version && !i18n_version.start_with?('1.8')
    Jekyll.logger.warn 'I18nPatch:', "jekyll-multiple-languages-plugin #{i18n_version} detected, patch targets 1.8.x — skipping patch"
    I18nPatch.patched!
    next
  end

  if defined?(TranslatedString)
    # ... apply patch ...
  end

  I18nPatch.patched!
end
```

#### build_timer.rb

Guard the `process_org` wrapper:

```ruby
# Depends on jekyll-multiple-languages-plugin providing process_org on Jekyll::Site
module BuildTimerSiteExtension
  def process
    super
    BuildTimer.finish('total_build')
    BuildTimer.log "Build finished at #{Time.now.strftime('%H:%M:%S')}"
  end

  if Jekyll::Site.method_defined?(:process_org)
    def process_org
      lang = config['lang']
      BuildTimer.log "--- Language pass: #{lang} (read + generate) ---"
      BuildTimer.start("read_and_generate:#{lang}")
      super
    end
  else
    Jekyll.logger.warn 'BuildTimer:', 'Jekyll::Site#process_org not found (jekyll-multiple-languages-plugin missing?) — skipping per-language generator timing'
  end
end
```

### 4. Dependency Vulnerability Scanning

Add `bundler-audit` to the Gemfile and audit tasks to the Rakefile:

```ruby
# Gemfile — add to development group
gem "bundler-audit", "~> 0.9"
```

```ruby
# Rakefile — new audit tasks
namespace :audit do
  desc "Scan Ruby gems for known vulnerabilities"
  task :ruby do
    puts "Scanning Ruby gems for vulnerabilities..."
    success = system("bundle-audit check --update")
    if success
      puts "No known vulnerabilities found in Ruby gems."
    else
      abort "Ruby gem vulnerabilities detected!"
    end
  end

  desc "Scan npm packages for known vulnerabilities"
  task :npm do
    puts "Scanning npm packages for vulnerabilities..."
    success = system("npm audit --audit-level=moderate")
    if success
      puts "No known vulnerabilities found in npm packages."
    else
      abort "npm package vulnerabilities detected!"
    end
  end

  desc "Scan all dependencies (Ruby + npm) for vulnerabilities"
  task :all => [:ruby, :npm]
end

desc "Scan Ruby gems for known vulnerabilities"
task :audit => 'audit:ruby'
```

## Error Handling

- Pagination: If a page fetch fails mid-pagination, the existing `Contentful::Error` rescue in `fetch_and_write_content` catches it and skips that content type.
- URI validation: `URI.parse` failures are caught and treated as unsafe (link rendered as `<span>`).
- Version guards: All guards log warnings via `Jekyll.logger.warn` and either skip the patch or continue with reduced functionality. No exceptions raised.
- Audit tasks: `system()` returns the exit status; `abort` is called on failure to propagate non-zero exit codes.

## Testing Strategy

Existing RSpec tests in `spec/` cover the mapper and fetcher logic. The changes should be verified by:

1. Unit tests for `html_escape` and `safe_uri?` helper methods
2. Unit tests for `fetch_entries` pagination with mocked client returning multi-page results
3. Manual verification of version guards by checking log output
4. Running `bundle exec rake audit` after adding bundler-audit
