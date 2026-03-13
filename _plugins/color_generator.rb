# frozen_string_literal: true

# Jekyll plugin to parse Paddelbuch SCSS color variables and expose them
# as site data for use in JavaScript (e.g., layer-styles.js).
#
# Reads _sass/settings/_paddelbuch_colours.scss, extracts $variable: #hex pairs,
# converts variable names to camelCase, and writes the result to
# site.data['paddelbuch_colors'].

module Jekyll
  class ColorGenerator < Generator
    safe true
    priority :high

    SCSS_PATH = File.join('_sass', 'settings', '_paddelbuch_colours.scss')
    COLOR_REGEX = /^\$([a-z0-9_-]+):\s*(#[0-9a-fA-F]{3,8})/

    def generate(site)
      scss_file = File.join(site.source, SCSS_PATH)

      unless File.readable?(scss_file)
        Jekyll.logger.warn 'ColorGenerator:', "Cannot read #{SCSS_PATH}"
        site.data['paddelbuch_colors'] = {}
        return
      end

      colors = parse_colors(File.read(scss_file))

      if colors.empty?
        Jekyll.logger.warn 'ColorGenerator:', "No colors found in #{SCSS_PATH}"
      end

      site.data['paddelbuch_colors'] = colors
    end

    private

    def parse_colors(content)
      colors = {}

      content.each_line do |line|
        match = line.match(COLOR_REGEX)
        next unless match

        name = match[1]
        hex = match[2]

        # Only keep standard 3 or 6 digit hex values (skip 4/8 digit alpha hex)
        next unless hex.length == 4 || hex.length == 7

        colors[to_camel_case(name)] = hex
      end

      colors
    end

    def to_camel_case(name)
      parts = name.split(/[-_]/)
      parts[0] + parts[1..].map(&:capitalize).join
    end
  end
end
