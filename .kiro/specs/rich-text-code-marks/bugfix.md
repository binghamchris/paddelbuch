# Bugfix Requirements Document

## Introduction

The `render_rich_text` method in `_plugins/contentful_mappers.rb` does not process the `marks` array on Contentful rich text `text` nodes. In Contentful's rich text model, inline formatting (code, bold, italic, underline) is represented via a `marks` array on text nodes, e.g. `{ "nodeType": "text", "value": "slug", "marks": [{ "type": "code" }] }`. The current `when 'text'` clause simply returns `node_value.to_s`, discarding all mark information. This causes inline code (and other marked text) to render as plain text instead of being wrapped in the appropriate HTML tags. The bug is visible on pages like `/en/offene-daten/daten-schema/` where field names like `slug` should appear as `<code>slug</code>`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a text node has a `marks` array containing `{ "type": "code" }` THEN the system renders the text as plain text without `<code>` tags

1.2 WHEN a text node has a `marks` array containing `{ "type": "bold" }` THEN the system renders the text as plain text without `<strong>` tags

1.3 WHEN a text node has a `marks` array containing `{ "type": "italic" }` THEN the system renders the text as plain text without `<em>` tags

1.4 WHEN a text node has a `marks` array containing `{ "type": "underline" }` THEN the system renders the text as plain text without `<u>` tags

1.5 WHEN a text node has multiple marks (e.g. both `code` and `bold`) THEN the system renders the text as plain text without any of the corresponding HTML tags

### Expected Behavior (Correct)

2.1 WHEN a text node has a `marks` array containing `{ "type": "code" }` THEN the system SHALL wrap the text value in `<code>` tags

2.2 WHEN a text node has a `marks` array containing `{ "type": "bold" }` THEN the system SHALL wrap the text value in `<strong>` tags

2.3 WHEN a text node has a `marks` array containing `{ "type": "italic" }` THEN the system SHALL wrap the text value in `<em>` tags

2.4 WHEN a text node has a `marks` array containing `{ "type": "underline" }` THEN the system SHALL wrap the text value in `<u>` tags

2.5 WHEN a text node has multiple marks THEN the system SHALL nest the corresponding HTML tags around the text value (e.g. `<strong><code>value</code></strong>` for bold + code)

2.6 WHEN a text node has an empty `marks` array or no `marks` key THEN the system SHALL render the text value as plain text (no wrapping tags)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a text node has no marks and appears inside a paragraph THEN the system SHALL CONTINUE TO render it as plain text within `<p>` tags

3.2 WHEN a text node has no marks and appears inside a hyperlink THEN the system SHALL CONTINUE TO render it as plain text within `<a>` tags

3.3 WHEN a text node has no marks and appears inside a table cell THEN the system SHALL CONTINUE TO render it as plain text within `<td>` or `<th>` tags

3.4 WHEN a text node has no marks and appears inside a heading THEN the system SHALL CONTINUE TO render it as plain text within the heading tags

3.5 WHEN a text node has no marks and appears inside a list item THEN the system SHALL CONTINUE TO render it as plain text within `<li>` tags

3.6 WHEN content contains no text nodes with marks THEN the system SHALL CONTINUE TO produce identical HTML output as before the fix
