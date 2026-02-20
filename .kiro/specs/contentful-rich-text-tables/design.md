# Contentful Rich Text Tables Bugfix Design

## Overview

The `render_rich_text` method in `_plugins/contentful_mappers.rb` does not handle Contentful's table node types (`table`, `table-row`, `table-cell`, `table-header-cell`). These nodes fall through to the `else` branch which recursively renders children without any HTML table wrappers, causing all table content to collapse into a flat sequence of `<p>` tags. The fix adds four `when` clauses to the existing `case` statement to emit proper `<table>`, `<tr>`, `<td>`, and `<th>` HTML elements.

## Glossary

- **Bug_Condition (C)**: The input rich text document contains one or more Contentful table node types (`table`, `table-row`, `table-cell`, `table-header-cell`)
- **Property (P)**: Table nodes are rendered as their corresponding HTML table elements (`<table>`, `<tr>`, `<td>`, `<th>`) with correct nesting
- **Preservation**: All existing non-table rich text rendering (paragraphs, headings, hyperlinks, lists, text) must remain unchanged
- **render_rich_text**: The method in `_plugins/contentful_mappers.rb` that recursively converts Contentful rich text node trees into HTML strings
- **node_type**: The string field on each Contentful rich text node that identifies its type (e.g., `'paragraph'`, `'table'`, `'table-row'`)

## Bug Details

### Fault Condition

The bug manifests when a Contentful rich text document contains any table-related node types. The `render_rich_text` method's `case` statement has no `when` clauses for `table`, `table-row`, `table-cell`, or `table-header-cell`, so these nodes hit the `else` branch which only recursively renders `node_content` without wrapping it in any HTML element.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type Array<RichTextNode> (Contentful rich text content array)
  OUTPUT: boolean

  RETURN ANY node IN flattenTree(input) WHERE
         node.nodeType IN ['table', 'table-row', 'table-cell', 'table-header-cell']
END FUNCTION
```

### Examples

- A table with one header row and one body row containing text cells renders as `<p>Header1</p><p>Header2</p><p>Cell1</p><p>Cell2</p>` instead of `<table><tr><th><p>Header1</p></th><th><p>Header2</p></th></tr><tr><td><p>Cell1</p></td><td><p>Cell2</p></td></tr></table>`
- A single-cell table renders as `<p>Content</p>` instead of `<table><tr><td><p>Content</p></td></tr></table>`
- A table with a hyperlink inside a cell renders the link correctly but without any table structure around it
- A document with paragraphs before and after a table renders the paragraphs correctly but the table content is flattened between them

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Paragraph nodes (`paragraph`) must continue to render as `<p>` elements
- Heading nodes (`heading-1`, `heading-2`, `heading-3`) must continue to render as `<h1>`, `<h2>`, `<h3>` elements
- Hyperlink nodes (`hyperlink`) must continue to render as `<a>` elements with correct `href`
- List nodes (`unordered-list`, `ordered-list`, `list-item`) must continue to render as `<ul>`, `<ol>`, `<li>` elements
- Text nodes (`text`) must continue to render their value as-is
- Documents containing no table nodes must produce identical HTML output

**Scope:**
All inputs that do NOT contain table node types should be completely unaffected by this fix. This includes:
- Pure paragraph/text documents
- Documents with headings and links
- Documents with lists
- Mixed documents that contain headings, paragraphs, links, and lists but no tables

## Hypothesized Root Cause

Based on the code analysis, the root cause is straightforward:

1. **Missing `when` clauses**: The `case node_type` statement in `render_rich_text` (lines ~97-117 of `contentful_mappers.rb`) handles `paragraph`, `text`, `hyperlink`, `unordered-list`, `ordered-list`, `list-item`, `heading-1`, `heading-2`, `heading-3` but has no cases for `table`, `table-row`, `table-cell`, or `table-header-cell`.

2. **Silent fallthrough**: The `else` branch calls `render_rich_text(node_content) if node_content`, which recursively processes children. For table nodes, this means the paragraph nodes inside cells get rendered as `<p>` tags directly, but no `<table>`, `<tr>`, `<td>`, or `<th>` wrappers are emitted.

3. **No error or warning**: The fallthrough is silent — no log message indicates that an unrecognized node type was encountered — making the bug non-obvious without inspecting the rendered HTML.

## Correctness Properties

Property 1: Fault Condition - Table Nodes Render as HTML Table Elements

_For any_ rich text content array containing table node types (`table`, `table-row`, `table-cell`, `table-header-cell`), the fixed `render_rich_text` method SHALL produce HTML output containing the corresponding HTML table elements (`<table>`, `<tr>`, `<td>`, `<th>`) with correct nesting, where each `table` produces `<table>...</table>`, each `table-row` produces `<tr>...</tr>`, each `table-cell` produces `<td>...</td>`, and each `table-header-cell` produces `<th>...</th>`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-Table Rich Text Rendering Unchanged

_For any_ rich text content array that does NOT contain any table node types, the fixed `render_rich_text` method SHALL produce exactly the same HTML output as the original (unfixed) method, preserving all existing paragraph, heading, hyperlink, list, and text rendering behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `_plugins/contentful_mappers.rb`

**Function**: `render_rich_text`

**Specific Changes**:
1. **Add `when 'table'` clause**: Render as `<table>#{render_rich_text(node_content)}</table>`
2. **Add `when 'table-row'` clause**: Render as `<tr>#{render_rich_text(node_content)}</tr>`
3. **Add `when 'table-cell'` clause**: Render as `<td>#{render_rich_text(node_content)}</td>`
4. **Add `when 'table-header-cell'` clause**: Render as `<th>#{render_rich_text(node_content)}</th>`

These four `when` clauses should be inserted into the existing `case` statement, following the same pattern used by all other node types (wrap recursive child rendering in the appropriate HTML tag).

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior. All tests are RSpec specs in `spec/contentful_mappers_spec.rb`, with property-based tests using the `rantly` gem already in the Gemfile.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that table nodes fall through to the `else` branch and produce no table HTML.

**Test Plan**: Write RSpec examples that pass table-containing rich text to `render_rich_text` and assert the output contains `<table>`, `<tr>`, `<td>`, `<th>`. Run on UNFIXED code to observe failures.

**Test Cases**:
1. **Simple table test**: A table with one row and one cell — assert output contains `<table>` and `<td>` (will fail on unfixed code)
2. **Header cell test**: A table with `table-header-cell` nodes — assert output contains `<th>` (will fail on unfixed code)
3. **Multi-row table test**: A table with multiple rows — assert output contains multiple `<tr>` elements (will fail on unfixed code)
4. **Mixed document test**: A document with paragraphs and a table — assert table HTML is present alongside paragraph HTML (will fail on unfixed code)

**Expected Counterexamples**:
- Output contains only `<p>` tags with no `<table>`, `<tr>`, `<td>`, or `<th>` elements
- Cause: missing `when` clauses for table node types in the `case` statement

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces correct table HTML.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := render_rich_text_fixed(input)
  ASSERT result contains '<table>' AND '</table>'
  ASSERT count('<tr>', result) == count(table-row nodes in input)
  ASSERT count('<td>', result) == count(table-cell nodes in input)
  ASSERT count('<th>', result) == count(table-header-cell nodes in input)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT render_rich_text_original(input) == render_rich_text_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing with `rantly` is recommended for preservation checking because:
- It generates many random non-table rich text documents automatically
- It catches edge cases in paragraph, heading, link, and list rendering
- It provides strong guarantees that no existing behavior is changed

**Test Plan**: Capture the behavior of the UNFIXED `render_rich_text` on randomly generated non-table documents, then verify the fixed version produces identical output.

**Test Cases**:
1. **Paragraph preservation**: Random paragraph/text documents produce identical output before and after fix
2. **Heading preservation**: Random heading documents produce identical output
3. **Link preservation**: Random hyperlink documents produce identical output
4. **List preservation**: Random list documents produce identical output
5. **Mixed non-table preservation**: Random documents mixing paragraphs, headings, links, and lists produce identical output

### Unit Tests

- Test `render_rich_text` with a simple single-cell table
- Test `render_rich_text` with header cells vs body cells
- Test `render_rich_text` with nested content inside table cells (paragraphs, links)
- Test `render_rich_text` with a table embedded in a larger document
- Test `render_rich_text` with an empty table (no rows)
- Test `extract_rich_text_html` with raw JSON containing a table

### Property-Based Tests

- Generate random table structures (varying rows, cells, header vs body) and verify correct HTML tag counts and nesting
- Generate random non-table documents and verify output is identical to unfixed code
- Generate mixed documents (tables + non-table content) and verify both table rendering and non-table preservation

### Integration Tests

- Test `map_static_page` with a Contentful page containing a table in its rich text body
- Test that the data schema page (`/en/offene-daten/daten-schema/`) renders tables correctly after the fix
