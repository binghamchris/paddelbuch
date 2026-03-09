# Bugfix Requirements Document

## Introduction

Tables authored in Contentful rich text fields are not rendered as HTML table elements on the Jekyll site. Instead, all table cell content appears as a flat sequence of `<p>` tags, destroying the tabular structure. This is most visible on the data schema page (`/en/offene-daten/daten-schema/`) where multiple field-description tables should be displayed.

The root cause is that the `render_rich_text` method in `_plugins/contentful_mappers.rb` does not handle Contentful's table-related node types (`table`, `table-row`, `table-cell`, `table-header-cell`). These nodes fall through to the `else` branch, which recursively renders child content without any table HTML wrapper elements. The paragraph nodes inside table cells are then rendered as `<p>` tags directly, producing a flat list of paragraphs instead of a structured table.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a Contentful rich text field contains a `table` node type THEN the system renders the table cell contents as a flat sequence of `<p>` tags with no `<table>`, `<tr>`, `<td>`, or `<th>` elements

1.2 WHEN a Contentful rich text field contains `table-row` node types THEN the system discards the row structure and renders all cell contents sequentially as paragraphs

1.3 WHEN a Contentful rich text field contains `table-header-cell` node types THEN the system does not distinguish header cells from body cells and renders both as plain `<p>` tags

1.4 WHEN a Contentful rich text field contains `table-cell` node types THEN the system does not wrap cell content in `<td>` elements

### Expected Behavior (Correct)

2.1 WHEN a Contentful rich text field contains a `table` node type THEN the system SHALL render it as an HTML `<table>` element containing the rendered child rows

2.2 WHEN a Contentful rich text field contains `table-row` node types THEN the system SHALL render each row as an HTML `<tr>` element containing the rendered child cells

2.3 WHEN a Contentful rich text field contains `table-header-cell` node types THEN the system SHALL render each header cell as an HTML `<th>` element containing the rendered cell content

2.4 WHEN a Contentful rich text field contains `table-cell` node types THEN the system SHALL render each cell as an HTML `<td>` element containing the rendered cell content

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a Contentful rich text field contains `paragraph` node types THEN the system SHALL CONTINUE TO render them as `<p>` elements

3.2 WHEN a Contentful rich text field contains `heading-1`, `heading-2`, or `heading-3` node types THEN the system SHALL CONTINUE TO render them as `<h1>`, `<h2>`, or `<h3>` elements respectively

3.3 WHEN a Contentful rich text field contains `hyperlink` node types THEN the system SHALL CONTINUE TO render them as `<a>` elements with the correct `href` attribute

3.4 WHEN a Contentful rich text field contains `unordered-list` or `ordered-list` node types THEN the system SHALL CONTINUE TO render them as `<ul>` or `<ol>` elements with `<li>` children

3.5 WHEN a Contentful rich text field contains `text` node types THEN the system SHALL CONTINUE TO render the text value as-is

3.6 WHEN a Contentful rich text field contains no table nodes THEN the system SHALL CONTINUE TO produce identical HTML output as before the fix
