# Contentful Rich Text Tables - Tasks

## Task 1: Write exploratory tests to confirm the bug

- [x] 1.1 Add RSpec examples in `spec/contentful_mappers_spec.rb` that pass table-containing rich text to `render_rich_text` and assert the output contains `<table>`, `<tr>`, `<td>`, `<th>` tags. These tests should FAIL on the unfixed code, confirming the bug.
  - Test a simple table with one row and one `table-cell`
  - Test a table with `table-header-cell` nodes
  - Test a multi-row table
  - Test a mixed document with paragraphs before and after a table
- [x] 1.2 [PBT-exploration] Property test: for any randomly generated table structure (random number of rows 1-5, cells 1-4 per row, with random text content), `render_rich_text` output should contain `<table>`, `<tr>`, and `<td>`/`<th>` tags with correct counts. This should FAIL on unfixed code, surfacing counterexamples.

## Task 2: Implement the fix in `render_rich_text`

- [x] 2.1 Add four `when` clauses to the `case node_type` statement in `render_rich_text` in `_plugins/contentful_mappers.rb`:
  - `when 'table'` → `"<table>#{render_rich_text(node_content)}</table>"`
  - `when 'table-row'` → `"<tr>#{render_rich_text(node_content)}</tr>"`
  - `when 'table-cell'` → `"<td>#{render_rich_text(node_content)}</td>"`
  - `when 'table-header-cell'` → `"<th>#{render_rich_text(node_content)}</th>"`

## Task 3: Write fix-checking tests

- [x] 3.1 Verify the exploratory tests from Task 1 now PASS on the fixed code by running `bundle exec rspec spec/contentful_mappers_spec.rb`.
- [-] 3.2 [PBT-fix] Property test: for any randomly generated table structure (random rows 1-5, cells 1-4, random text, mix of `table-cell` and `table-header-cell`), the fixed `render_rich_text` output contains the correct count of `<table>`, `<tr>`, `<td>`, and `<th>` tags matching the input structure.

## Task 4: Write preservation tests

- [~] 4.1 [PBT-preservation] Property test: for any randomly generated non-table rich text document (random mix of paragraphs, headings, hyperlinks, lists with random text content), the fixed `render_rich_text` produces identical output to the original unfixed behavior. Use `rantly` to generate random document structures excluding table node types.
- [~] 4.2 Add unit tests verifying existing non-table rendering is unchanged:
  - Paragraph with text
  - Heading levels 1-3
  - Hyperlink with URI
  - Ordered and unordered lists
  - Mixed document with all non-table node types

## Task 5: Integration test with `extract_rich_text_html`

- [~] 5.1 Add an RSpec example testing `extract_rich_text_html` with a raw JSON document containing a table, verifying the full pipeline from JSON parsing through to correct table HTML output.
- [~] 5.2 Add an RSpec example testing `map_static_page` with a rich text field containing a table, verifying the `page_body` output includes proper table HTML.
