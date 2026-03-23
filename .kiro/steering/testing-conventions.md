---
inclusion: fileMatch
fileMatchPattern: ["spec/**/*.rb", "_tests/**/*.js"]
---

# Testing Conventions

Property-based testing is a core practice in this project, not an afterthought. New logic should include property-based tests alongside unit tests.

## Test Suites

| Suite | Framework | Location | Command |
|-------|-----------|----------|---------|
| Ruby | RSpec + Rantly | `spec/` | `bundle exec rspec` |
| JS unit | Jest | `_tests/unit/` | `npm test` |
| JS property | Jest + fast-check | `_tests/property/` | `npm run test:property` |
| Python | pytest | `tests/` | `python3 -m pytest tests/` |

## Naming Conventions

- Ruby: `spec/*_spec.rb` or `spec/plugins/*_spec.rb`
- JS unit: `_tests/unit/*.test.js`
- JS property: `_tests/property/*.property.test.js`

## Property-Based Testing Patterns

Ruby (Rantly):

```ruby
property_of {
  { 'slug' => string(:alpha, 10), 'locale' => choose('de', 'en') }
}.check(100) { |data|
  expect(data['slug']).not_to be_empty
}
```

JavaScript (fast-check):

```javascript
fc.assert(
  fc.property(
    fc.array(fc.record({ slug: fc.string(), spotType: fc.string() })),
    (markers) => {
      // Assert invariant holds for all generated inputs
    }
  )
);
```

## Key Rules

- New Jekyll plugins must have RSpec tests in `spec/plugins/`, including Rantly property tests for any logic that processes variable data
- New JS modules must have Jest tests in `_tests/unit/` and fast-check property tests in `_tests/property/`
- JS DOM tests need `@jest-environment jsdom` at the top of the file
- Ruby tests are not part of the Amplify build — run them locally before pushing plugin changes
- Reference `#[[file:docs/testing.md]]` for the full test structure and writing guide
