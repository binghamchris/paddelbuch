# Rich Text Code Marks Bugfix Design

## Overview

The `render_rich_text` method in `_plugins/contentful_mappers.rb` ignores the `marks` array on Contentful rich text `text` nodes. The `when 'text'` clause returns `node_value.to_s` without inspecting marks, so inline formatting (code, bold, italic, underline) is lost. The fix adds mark processing to the `text` node handler, wrapping the text value in the appropriate HTML tags based on the marks array. This is a targeted, minimal change to a single `when` clause.

## Glossary

- **Bug_Condition (C)**: A text node has a non-empty `marks` array — the marks are discarded and the text renders as plain text
- **Property (P)**: When marks are present, the text value should be wrapped in the corresponding HTML tags (`<code>`, `<strong>`, `<em>`, `<u>`)
- **Preservation**: Unmarked text nodes, and all other node types (paragraphs, headings, tables, hyperlinks, lists), must continue to render identically
- **render_rich_text**: The method in `_plugins/contentful_mappers.rb` that recursively converts Contentful rich text JSON into HTML
- **marks**: An array on Contentful text nodes containing objects like `{ "type": "code" }` that indicate inline formatting

## Bug Details

### Fault Condition

The bug manifests when a Contentful rich text `text` node has a non-empty `marks` array. The `render_rich_text` method's `when 'text'` clause returns `node_value.to_s` without reading the marks, so all inline formatting is silently dropped.

**Formal Specification:**
```
FUNCTION isBugCondition(node)
  INPUT: node of type Hash (Contentful rich text node)
  OUTPUT: boolean

  RETURN node['nodeType'] == 'text'
         AND node['marks'] IS NOT nil
         AND node['marks'].length > 0
         AND each mark IN node['marks'] has mark['type'] IN ['code', 'bold', 'italic', 'underline']
END FUNCTION
```

### Examples

- Text node `{ "value": "slug", "marks": [{ "type": "code" }] }` → Expected: `<code>slug</code>`, Actual: `slug`
- Text node `{ "value": "important", "marks": [{ "type": "bold" }] }` → Expected: `<strong>important</strong>`, Actual: `important`
- Text node `{ "value": "note", "marks": [{ "type": "italic" }] }` → Expected: `<em>note</em>`, Actual: `note`
- Text node `{ "value": "term", "marks": [{ "type": "bold" }, { "type": "code" }] }` → Expected: `<strong><code>term</code></strong>`, Actual: `term`
- Text node `{ "value": "plain text", "marks": [] }` → Expected: `plain text`, Actual: `plain text` (correct, no change needed)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Text nodes with empty or missing `marks` arrays must continue to render as plain text
- All non-text node types (paragraph, heading, hyperlink, table, list, etc.) must render identically
- The recursive structure of `render_rich_text` must remain intact — marks processing only affects the leaf `text` node output
- Existing tests for table rendering, hyperlinks, headings, and lists must continue to pass

**Scope:**
All inputs that do NOT involve text nodes with non-empty marks arrays should be completely unaffected by this fix. This includes:
- Text nodes with empty marks arrays or no marks key
- All container node types (paragraph, heading, table, list, hyperlink)
- Rich text documents with no marked text at all

## Hypothesized Root Cause

Based on the bug description, the root cause is straightforward:

1. **Missing marks processing in the `when 'text'` clause**: The current code at line ~100 of `_plugins/contentful_mappers.rb` is:
   ```ruby
   when 'text'
     node_value.to_s
   ```
   This completely ignores the `marks` array. The node Hash contains a `'marks'` key with an array of mark objects, but it is never read.

2. **No mark-to-tag mapping exists**: There is no code anywhere in the module that maps Contentful mark types (`code`, `bold`, `italic`, `underline`) to their HTML equivalents (`<code>`, `<strong>`, `<em>`, `<u>`).

## Correctness Properties

Property 1: Fault Condition - Marked Text Nodes Render With Correct HTML Tags

_For any_ text node where the marks array is non-empty (isBugCondition returns true), the fixed `render_rich_text` method SHALL wrap the text value in the HTML tags corresponding to each mark type, with tags nested in a consistent order.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Unmarked Text and Non-Text Nodes Unchanged

_For any_ input where the text node has no marks or the node is not a text node (isBugCondition returns false), the fixed `render_rich_text` method SHALL produce the same result as the original method, preserving all existing rendering behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `_plugins/contentful_mappers.rb`

**Function**: `render_rich_text`

**Specific Changes**:

1. **Define a mark-to-tag mapping**: Add a constant or local mapping from Contentful mark types to HTML tag names:
   - `'code'` → `'code'`
   - `'bold'` → `'strong'`
   - `'italic'` → `'em'`
   - `'underline'` → `'u'`

2. **Extract marks from the node**: In the `when 'text'` clause, read the marks array:
   ```ruby
   node_marks = node.is_a?(Hash) ? (node['marks'] || []) : []
   ```

3. **Apply marks by wrapping text**: Iterate over the marks array and wrap the text value in the corresponding HTML tags. For multiple marks, nest the tags:
   ```ruby
   text = node_value.to_s
   node_marks.each do |mark|
     tag = MARK_TAG_MAP[mark['type']]
     text = "<#{tag}>#{text}</#{tag}>" if tag
   end
   text
   ```

4. **Handle edge cases**: Unknown mark types should be silently ignored (no wrapping). Empty or nil marks arrays should produce the same output as before (plain text).

5. **No changes to other clauses**: All other `when` branches in the `case` statement remain untouched.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that the `when 'text'` clause ignores marks.

**Test Plan**: Write tests that create text nodes with various marks and assert the output contains the expected HTML tags. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Single code mark**: Text node with `marks: [{ "type": "code" }]` should produce `<code>text</code>` (will fail on unfixed code)
2. **Single bold mark**: Text node with `marks: [{ "type": "bold" }]` should produce `<strong>text</strong>` (will fail on unfixed code)
3. **Single italic mark**: Text node with `marks: [{ "type": "italic" }]` should produce `<em>text</em>` (will fail on unfixed code)
4. **Multiple marks**: Text node with both bold and code marks should produce nested tags (will fail on unfixed code)

**Expected Counterexamples**:
- All marked text renders as plain text without any HTML wrapping tags
- Root cause confirmed: the `when 'text'` clause returns `node_value.to_s` without reading marks

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL node WHERE isBugCondition(node) DO
  result := render_rich_text_fixed([node])
  FOR EACH mark IN node['marks'] DO
    tag := MARK_TAG_MAP[mark['type']]
    ASSERT result CONTAINS "<#{tag}>" AND "</#{tag}>"
  END FOR
  ASSERT result CONTAINS node['value']
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL content WHERE no text node has non-empty marks DO
  ASSERT render_rich_text_original(content) == render_rich_text_fixed(content)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random document structures without marks to verify no regressions
- It catches edge cases in the interaction between marks processing and other node types
- The existing PBT tests for table and non-table rendering already cover much of this

**Test Plan**: Observe behavior on UNFIXED code first for unmarked text in various contexts, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Unmarked text preservation**: Verify text nodes with empty marks arrays render identically before and after fix
2. **Table rendering preservation**: Verify existing table rendering PBT tests continue to pass
3. **Non-table rendering preservation**: Verify existing non-table rendering PBT tests continue to pass
4. **Hyperlink text preservation**: Verify text inside hyperlinks without marks renders identically

### Unit Tests

- Test each individual mark type (code, bold, italic, underline) produces the correct HTML tag
- Test multiple simultaneous marks produce correctly nested tags
- Test empty marks array produces plain text
- Test missing marks key produces plain text
- Test unknown mark types are silently ignored
- Test marked text inside paragraphs, headings, table cells, and hyperlinks

### Property-Based Tests

- Generate random text values and random subsets of mark types, verify each mark's HTML tag appears in the output and the text value is preserved
- Generate random document structures with no marks, verify output matches the original function's output
- Generate random combinations of marked and unmarked text nodes in paragraphs, verify correct rendering

### Integration Tests

- Test a full rich text document with code-marked field names in a table (the original bug scenario from `/en/offene-daten/daten-schema/`)
- Test a static page with mixed marked and unmarked content renders correctly through `map_static_page`
- Test raw JSON format documents with marks render correctly through `extract_rich_text_html`
