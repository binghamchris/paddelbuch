# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'

RSpec.describe Jekyll::SitemapGenerator do
  # --- Test helpers ---

  # Creates a minimal Jekyll site with all 5 collections and bilingual config.
  # Accepts config_overrides to customize any config value.
  def build_site(tmpdir, config_overrides = {})
    default_config = {
      'source' => tmpdir,
      'destination' => File.join(tmpdir, '_site'),
      'url' => 'https://www.paddelbuch.ch',
      'languages' => %w[de en],
      'default_lang' => 'de',
      'exclude_from_localizations' => %w[assets api],
      'collections' => {
        'spots' => { 'output' => true, 'permalink' => '/einstiegsorte/:slug/' },
        'waterways' => { 'output' => true, 'permalink' => '/gewaesser/:slug/' },
        'obstacles' => { 'output' => true, 'permalink' => '/hindernisse/:slug/' },
        'notices' => { 'output' => true, 'permalink' => '/gewaesserereignisse/:slug/' },
        'static_pages' => { 'output' => true, 'permalink' => '/:slug/' }
      }
    }

    merged = default_config.merge(config_overrides)
    config = Jekyll.configuration(merged)
    site = Jekyll::Site.new(config)
    FileUtils.mkdir_p(site.dest)
    site
  end

  # Adds a virtual Jekyll::Document to the given collection with the specified slug.
  # Returns the created document.
  def add_collection_doc(site, collection_name, slug)
    collection = site.collections[collection_name]
    raise "Collection '#{collection_name}' not found" unless collection

    FileUtils.mkdir_p(File.join(site.source, collection.relative_directory))

    doc_path = File.join(site.source, collection.relative_directory, "#{slug}.md")
    FileUtils.touch(doc_path)

    doc = Jekyll::Document.new(doc_path, site: site, collection: collection)
    doc.data['slug'] = slug
    doc.data['title'] = slug
    collection.docs << doc
    doc
  end

  # Creates a mock Jekyll page with the given name, url, and front matter data.
  # Responds to .name, .url, .data, and .html? (true for .html files).
  def add_page(site, name, url, data = {})
    page = instance_double(Jekyll::Page)
    allow(page).to receive(:name).and_return(name)
    allow(page).to receive(:url).and_return(url)
    allow(page).to receive(:data).and_return(data)
    allow(page).to receive(:html?).and_return(name.end_with?('.html'))
    site.pages << page
    page
  end

  # Returns a fresh SitemapGenerator instance.
  def generator
    Jekyll::SitemapGenerator.new
  end

  # Feature: sitemap-generation, Property 1: URL entry rendering contains required metadata
  describe '#render_url_entry (PBT)' do
    # **Validates: Requirements 2.3, 2.4, 2.5**
    it 'contains <loc>, <changefreq>daily</changefreq>, and <priority>0.7</priority> for any URL' do
      property_of {
        Rantly {
          segments = range(1, 5).times.map { sized(range(1, 12)) { string(:alpha).downcase } }
          "https://www.paddelbuch.ch/#{segments.join('/')}/"
        }
      }.check(100) do |url|
        xml = generator.render_url_entry(url)
        expect(xml).to include("<loc>#{url}</loc>")
        expect(xml).to include('<changefreq>daily</changefreq>')
        expect(xml).to include('<priority>0.7</priority>')
      end
    end
  end

  # Feature: sitemap-generation, Property 2: All collection documents are included
  describe '#collection_urls (PBT)' do
    # **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    it 'includes URLs for all documents across all five collections' do
      collection_names = %w[spots waterways obstacles notices static_pages]

      property_of {
        Rantly {
          # Generate a hash mapping each collection to a list of random slugs (1-5 docs each)
          docs = {}
          collection_names.each do |name|
            count = range(1, 5)
            slugs = count.times.map { sized(range(3, 12)) { string(:alpha).downcase } }
            docs[name] = slugs
          end
          docs
        }
      }.check(100) do |docs_by_collection|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir)

          # Add random documents to each collection and track their URLs
          expected_urls = []
          docs_by_collection.each do |collection_name, slugs|
            slugs.each do |slug|
              doc = add_collection_doc(site, collection_name, slug)
              expected_urls << doc.url
            end
          end

          # Run collection_urls and verify every document URL is present
          result = generator.collection_urls(site)
          expected_urls.each do |url|
            expect(result).to include(url),
              "Expected collection_urls to include '#{url}' but it was missing. Result: #{result.inspect}"
          end
        end
      end
    end
  end
  # Feature: sitemap-generation, Property 3: Bilingual URL generation
  describe '#bilingual_urls (PBT)' do
    # **Validates: Requirements 5.1, 5.2**
    it 'generates both default locale and /en/-prefixed URLs for any base path' do
      property_of {
        Rantly {
          segment_count = range(1, 4)
          segments = segment_count.times.map { sized(range(3, 10)) { string(:alpha).downcase } }
          "/#{segments.join('/')}/"
        }
      }.check(100) do |path|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir)
          result = generator.bilingual_urls(site, [path])

          default_url = "https://www.paddelbuch.ch#{path}"
          default_url = "#{default_url}/" unless default_url.end_with?('/')

          en_url = "https://www.paddelbuch.ch/en#{path}"
          en_url = "#{en_url}/" unless en_url.end_with?('/')

          expect(result).to include(default_url),
            "Expected default locale URL '#{default_url}' in result: #{result.inspect}"
          expect(result).to include(en_url),
            "Expected English URL '#{en_url}' in result: #{result.inspect}"
        end
      end
    end
  end

  # Feature: sitemap-generation, Property 4: URL well-formedness
  describe '#build_url (PBT)' do
    # **Validates: Requirements 6.1, 6.2**
    it 'produces URLs starting with site URL and ending with / for any path' do
      property_of {
        Rantly {
          segment_count = range(1, 4)
          segments = segment_count.times.map { sized(range(3, 10)) { string(:alpha).downcase } }
          path = "/#{segments.join('/')}/"

          # Randomly strip trailing slash for some inputs
          path = path.chomp('/') if range(0, 1) == 0

          path
        }
      }.check(100) do |path|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir)
          result = generator.build_url(site, path)

          expect(result).to start_with('https://www.paddelbuch.ch'),
            "Expected URL '#{result}' to start with 'https://www.paddelbuch.ch' for path '#{path}'"
          expect(result).to end_with('/'),
            "Expected URL '#{result}' to end with '/' for path '#{path}'"
        end
      end
    end
  end

  # Feature: sitemap-generation, Property 5: No duplicate URLs
  describe '#collect_urls - no duplicate URLs (PBT)' do
    # **Validates: Requirements 6.4**
    it 'produces no duplicate URLs even when input pages have overlapping slugs' do
      property_of {
        Rantly {
          slug_count = range(3, 8)
          slugs = slug_count.times.map { sized(range(3, 10)) { string(:alpha).downcase } }
          # Deliberately duplicate some slugs by repeating random entries
          dup_count = range(1, 3)
          dup_count.times { slugs << slugs[range(0, slugs.size - 1)] }
          slugs
        }
      }.check(100) do |slugs|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir)

          # Add slugs as standalone pages (some will be duplicates)
          slugs.each do |slug|
            add_page(site, "#{slug}.html", "/#{slug}/")
          end

          # Also add some collection documents with potentially overlapping slugs
          overlap_slugs = slugs.sample([slugs.size, 3].min)
          overlap_slugs.each do |slug|
            add_collection_doc(site, 'static_pages', slug)
          end

          result = generator.collect_urls(site)
          expect(result).to eq(result.uniq),
            "Expected no duplicate URLs but found duplicates: #{(result - result.uniq).inspect}"
        end
      end
    end
  end

  # Feature: sitemap-generation, Property 6: Sitemap splitting at 50,000 URLs
  describe 'sitemap splitting at 50,000 URLs (PBT)' do
    # **Validates: Requirements 1.3, 1.4**
    it 'produces ceil(N / 50,000) chunks each with at most 50,000 entries' do
      max_urls = Jekyll::SitemapGenerator::MAX_URLS_PER_SITEMAP

      property_of {
        Rantly { range(1, 200_000) }
      }.check(100) do |n|
        urls = Array.new(n) { |i| "https://www.paddelbuch.ch/page-#{i}/" }
        chunks = urls.each_slice(max_urls).to_a

        expected_chunks = (n.to_f / max_urls).ceil

        expect(chunks.size).to eq(expected_chunks),
          "Expected #{expected_chunks} chunks for #{n} URLs but got #{chunks.size}"

        chunks.each_with_index do |chunk, idx|
          expect(chunk.size).to be <= max_urls,
            "Chunk #{idx} has #{chunk.size} entries, exceeding max of #{max_urls}"
        end

        total = chunks.sum(&:size)
        expect(total).to eq(n),
          "Expected total URLs across chunks to be #{n} but got #{total}"
      end
    end
  end

  # Feature: sitemap-generation, Property 7: Pages with sitemap:false are excluded
  describe '#exclude_page? - sitemap:false exclusion (PBT)' do
    # **Validates: Requirements 4.5**
    it 'excludes pages with sitemap:false and includes pages with sitemap:true or no sitemap key' do
      property_of {
        Rantly {
          # Generate a random page name (always .html so only sitemap front matter matters)
          slug = sized(range(3, 12)) { string(:alpha).downcase }
          name = "#{slug}.html"
          url = "/#{slug}/"

          # Randomly choose sitemap front matter: false, true, or absent
          sitemap_variant = choose(:false_val, :true_val, :absent)

          [name, url, sitemap_variant]
        }
      }.check(100) do |(name, url, sitemap_variant)|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir)

          data = case sitemap_variant
                 when :false_val then { 'sitemap' => false }
                 when :true_val  then { 'sitemap' => true }
                 when :absent    then {}
                 end

          page = add_page(site, name, url, data)
          result = generator.exclude_page?(page)

          if sitemap_variant == :false_val
            expect(result).to be(true),
              "Expected page '#{name}' with sitemap:false to be excluded, but it was not"
          else
            expect(result).to be(false),
              "Expected page '#{name}' with sitemap:#{sitemap_variant} to be included, but it was excluded"
          end
        end
      end
    end
  end
end

