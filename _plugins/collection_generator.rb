# Jekyll plugin to generate collection documents from Contentful YAML data
#
# The ContentfulFetcher writes data to _data/*.yml but Jekyll collections
# require documents in their collection directories (_spots/, _waterways/, etc.)
# to generate pages. This generator bridges that gap by creating virtual
# Jekyll::Document objects from the YAML data, filtered by the current locale.
#
# Runs after ContentfulFetcher (priority :highest) but before API/Tile generators.

module Jekyll
  class CollectionGenerator < Generator
    safe true
    priority :high

    # Maps collection name to its data key in site.data and required fields
    COLLECTIONS = {
      'spots' => { data_key: 'spots' },
      'waterways' => { data_key: 'waterways' },
      'obstacles' => { data_key: 'obstacles' },
      'notices' => { data_key: 'notices' },
      'static_pages' => { data_key: 'static_pages' }
    }.freeze

    def generate(site)
      current_locale = site.config['lang'] || site.config['default_lang'] || 'de'

      COLLECTIONS.each do |collection_name, config|
        collection = site.collections[collection_name]
        next unless collection

        data = site.data[config[:data_key]]
        next unless data.is_a?(Array)

        # Filter entries for the current locale
        locale_entries = data.select { |item| item['locale'] == current_locale }

        locale_entries.each do |entry|
          slug = entry['slug']
          next unless slug && !slug.empty?

          doc = create_document(site, collection, entry, slug)
          collection.docs << doc
        end
      end
    end

    private

    def create_document(site, collection, entry, slug)
      # Create a virtual document path (doesn't need to exist on disk)
      path = File.join(site.source, collection.relative_directory, "#{slug}.md")

      doc = Jekyll::Document.new(path, site: site, collection: collection)

      # Copy all entry fields into the document's data (front matter)
      entry.each do |key, value|
        doc.data[key] = value
      end

      # Ensure required fields are set
      doc.data['slug'] = slug
      doc.data['title'] = entry['name'] || slug

      # For static_pages, build permalink from menu_slug + slug
      if collection.label == 'static_pages' && entry['menu_slug']
        doc.data['permalink'] = "/#{entry['menu_slug']}/#{slug}/"
      end

      doc
    end
  end
end
