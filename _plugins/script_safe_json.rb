# frozen_string_literal: true

require 'json'

# Serialises data for embedding INSIDE an inline HTML element.
#
# Why this exists
# ---------------
# `JSON.generate` produces valid JSON, and valid JSON is not automatically safe to place
# between `<script>` and `</script>`. Ruby leaves `<` and `>` as literal characters, so a
# string value containing `</script>` terminates the element early. The browser then stops
# treating the remainder as data and starts parsing it as markup.
#
# That mattered here because Contentful-editable taxonomy names flow into
# `map_data_config` and `layer_control_config` (see `precompute_generator.rb`) and are
# emitted raw into `<script type="application/json">` elements by `map-init.html`,
# `detail-map-layers.html` and `layer-control.html`. Liquid's `{{ }}` does not HTML-escape,
# so nothing else stood between a CMS field and the page structure.
#
# Reproduced before fixing: a type name of
#   Naturpark </script><meta http-equiv=refresh content=0;url=//evil.example>
# closed the data element and left the `<meta>` as a real DOM node.
#
# The site's CSP has no `unsafe-inline`, so this was not script execution. It still allowed
# arbitrary non-script markup -- redirect via meta refresh, content spoofing -- and it broke
# `JSON.parse`, which takes the map down for every visitor. Editor-gated, but the CMS is a
# trust boundary, not a guarantee.
#
# What is escaped, and why these characters
# -----------------------------------------
# `<` and `>` as `\u003c` / `\u003e`, which prevents any tag -- opening or closing -- from
# being formed, so `</script>`, `<!--` and `<script` are all neutralised at once rather than
# blacklisted individually.
#
# `&` as `\u0026`, because an HTML parser resolves entities in some contexts; escaping it
# removes the possibility of a reference reconstituting a bracket.
#
# U+2028 and U+2029 as `\u2028` / `\u2029`. These are valid in JSON but were historically
# invalid as raw line terminators in JavaScript string literals. Not a concern for
# `type="application/json"`, which is parsed rather than executed -- included because this
# helper is meant to be reusable for a `<script>` block that IS executed, where it matters.
#
# The escapes are all inside JSON string literals, so `JSON.parse` yields byte-identical
# values to `JSON.generate`. This changes the transport encoding, never the data.
#
# NOT for `/api/*.json`
# ---------------------
# Do not use this in `api_generator.rb`. Those files are fetched, not embedded, so the
# hazard does not apply -- and their output must stay byte-compatible with the old Gatsby
# site, so changing the encoding would be a regression.
module ScriptSafeJson
  # Escapes applied after serialisation. Operating on the JSON text rather than on the
  # input data means every nested string, key and array element is covered, without having
  # to walk the structure.
  ESCAPES = {
    '<' => '\u003c',
    '>' => '\u003e',
    '&' => '\u0026',
    "\u2028" => '\u2028',
    "\u2029" => '\u2029'
  }.freeze

  ESCAPE_PATTERN = /[<>&\u2028\u2029]/.freeze

  # Serialise +object+ for safe inclusion inside an inline HTML element.
  #
  # @param object [Object] any JSON-serialisable value
  # @return [String] JSON text containing no character that can open or close a tag
  def self.generate(object)
    JSON.generate(object).gsub(ESCAPE_PATTERN) { |char| ESCAPES[char] }
  end
end
