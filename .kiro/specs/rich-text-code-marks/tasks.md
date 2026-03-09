# Tasks

## 1. Add mark-to-tag mapping and marks processing to render_rich_text

- [x] 1.1 Add a `MARK_TAG_MAP` constant to the `ContentfulMappers` module mapping Contentful mark types to HTML tag names: `'code' => 'code'`, `'bold' => 'strong'`, `'italic' => 'em'`, `'underline' => 'u'`
- [x] 1.2 Update the `when 'text'` clause in `render_rich_text` to extract the marks array from the node and wrap the text value in the corresponding HTML tags for each mark, nesting tags for multiple marks, and leaving unmarked text unchanged

## 2. Write exploratory tests to confirm the bug on unfixed code

- [x] 2.1 [PBT-exploration] Add a property-based test that generates random text values with random non-empty subsets of mark types and asserts the output contains the corresponding HTML tags (expected to fail on unfixed code) `spec/contentful_mappers_spec.rb` **Validates: Property 1**

## 3. Write fix-checking tests

- [x] 3.1 Add unit tests for each individual mark type (`code`, `bold`, `italic`, `underline`) verifying the correct HTML tag is produced
- [x] 3.2 Add unit tests for multiple simultaneous marks verifying correctly nested tags
- [x] 3.3 Add unit tests for edge cases: empty marks array, missing marks key, unknown mark type
- [x] 3.4 Add unit test for marked text inside a paragraph, heading, table cell, and hyperlink
- [x] 3.5 [PBT-fix] Add a property-based test that generates random text values with random subsets of mark types and verifies each mark's HTML tag wraps the text value `spec/contentful_mappers_spec.rb` **Validates: Property 1**

## 4. Write preservation tests

- [x] 4.1 Add unit tests verifying unmarked text nodes render identically to the original behavior (plain text)
- [x] 4.2 [PBT-preservation] Add a property-based test that generates random document structures with NO marks and verifies the output matches the original rendering (no mark tags appear, all text content preserved) `spec/contentful_mappers_spec.rb` **Validates: Property 2**
- [x] 4.3 Verify existing table and non-table PBT tests still pass after the fix

## 5. Integration test

- [x] 5.1 Add an integration test simulating the original bug scenario: a rich text document with code-marked field names inside a table, rendered through `extract_rich_text_html`, verifying `<code>` tags appear in the output
