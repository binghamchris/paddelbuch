# frozen_string_literal: true

require 'json'
require_relative '../../_plugins/script_safe_json'

# Regression cover for stored HTML injection through inline JSON data elements.
#
# `JSON.generate` produces valid JSON, and valid JSON is not automatically safe between
# `<script>` and `</script>`: Ruby leaves `<` and `>` literal, so a string containing
# `</script>` closes the element and the remainder is parsed as markup.
#
# The reachable path was Contentful taxonomy `name` fields -> `map_type` (unescaped) ->
# `_data` -> `precompute_generator` -> `<script type="application/json">` in three includes.
# Liquid's `{{ }}` does not HTML-escape, so nothing else intervened.
#
# The site CSP has no `unsafe-inline`, so this was never script execution. It did permit
# arbitrary non-script markup and it broke `JSON.parse`, taking the map down.
RSpec.describe ScriptSafeJson do
  # The exact payload used to reproduce the defect before it was fixed.
  HOSTILE_NAME = 'Naturpark </script><meta http-equiv=refresh content=0;url=//evil.example>'

  describe 'the hazard it exists to remove' do
    it 'is a real hazard: plain JSON.generate leaves a literal closing tag' do
      # Asserted so the test documents WHY the helper exists. If Ruby ever starts escaping
      # this by default, this expectation fails and the helper can be reconsidered.
      expect(JSON.generate('name' => HOSTILE_NAME)).to include('</script>')
    end

    it 'emits no literal closing script tag' do
      expect(described_class.generate('name' => HOSTILE_NAME)).not_to include('</script>')
    end

    it 'emits no angle bracket at all, so no tag can be formed' do
      # Stronger than blacklisting `</script>`: `<` is what allows any tag, including
      # `<script`, `<!--` and `<img onerror=...>`.
      out = described_class.generate('name' => HOSTILE_NAME)
      expect(out).not_to include('<')
      expect(out).not_to include('>')
    end

    it 'escapes ampersands so an entity cannot reconstitute a bracket' do
      expect(described_class.generate('a' => 'x & y')).to include('\u0026')
      expect(described_class.generate('a' => 'x & y')).not_to include(' & ')
    end
  end

  describe 'the data is unchanged, only its encoding' do
    it 'round-trips the hostile value byte-identically' do
      # The whole design constraint: this must be an encoding change, never a data change.
      # If it mangled values, the map would render corrupted type names.
      payload = { 'name' => HOSTILE_NAME, 'nested' => { 'list' => ['a<b', 'c&d'] } }
      expect(JSON.parse(described_class.generate(payload))).to eq(payload)
    end

    it 'round-trips values that need no escaping' do
      payload = { 'slug' => 'naturpark-rhein', 'count' => 42, 'flag' => true, 'none' => nil }
      expect(JSON.parse(described_class.generate(payload))).to eq(payload)
    end

    it 'escapes inside keys as well as values' do
      # Keys are attacker-influenced too: protectedAreaTypeNames is keyed by slug.
      out = described_class.generate('a</script>b' => 'v')
      expect(out).not_to include('</script>')
      expect(JSON.parse(out).keys).to eq(['a</script>b'])
    end

    it 'escapes the JavaScript line terminators' do
      # Valid in JSON, historically invalid raw in JS string literals. Harmless for
      # application/json, but this helper is meant to be reusable for an executed block.
      out = described_class.generate('a' => "line\u2028break\u2029end")
      expect(out).to include('\u2028')
      expect(out).to include('\u2029')
      expect(JSON.parse(out)['a']).to eq("line\u2028break\u2029end")
    end
  end

  describe 'the element cannot be broken out of' do
    it 'survives embedding in a script element without terminating it' do
      # Reproduces the original attack shape end to end: build the element the way the
      # includes do, then confirm the only closing tag present is the intended one.
      body = described_class.generate('name' => HOSTILE_NAME)
      element = %(<script type="application/json" id="map-data-config">\n#{body}\n</script>)
      expect(element.scan('</script>').length).to eq(1)
      expect(element.index('</script>')).to be > element.index(body)
    end
  end
end
