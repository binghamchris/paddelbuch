# frozen_string_literal: true

# Copies the SVG favicon to /favicon.ico in the site output so that
# automatic browser requests to /favicon.ico are served correctly
# instead of returning a 404.

module Paddelbuch
  class FaviconGenerator < Jekyll::Generator
    safe true
    priority :low

    FAVICON_SOURCE = "assets/images/logo-favicon.svg"

    def generate(site)
      source_path = File.join(site.source, FAVICON_SOURCE)
      return unless File.exist?(source_path)

      site.static_files << FaviconFile.new(site, source_path)
    end
  end

  class FaviconFile < Jekyll::StaticFile
    def initialize(site, source_path)
      @source_path = source_path
      super(site, site.source, "", "favicon.ico")
    end

    def path
      @source_path
    end

    def destination(dest)
      File.join(dest, "favicon.ico")
    end
  end
end
