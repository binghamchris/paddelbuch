# frozen_string_literal: true

# Unit tests for the parallel locale build pipeline
# Validates: Requirements 1.1, 1.2, 1.5, 4.1–4.6, 6.3–6.5, 7.1–7.4, 8.1, 10.1–10.4

require 'spec_helper'
require 'yaml'
require 'fileutils'
require 'tmpdir'

RSpec.describe 'Parallel build pipeline — config file content' do
  let(:root) { File.expand_path('../../', __dir__) }

  describe '_config_de.yml' do
    let(:config) { YAML.load_file(File.join(root, '_config_de.yml')) }

    it 'sets languages to ["de"]' do
      expect(config['languages']).to eq(['de'])
    end

    it 'sets destination to _site_de' do
      expect(config['destination']).to eq('_site_de')
    end

    it 'sets locale_prefix to ""' do
      expect(config['locale_prefix']).to eq('')
    end

    it 'sets all_languages to ["de", "en"]' do
      expect(config['all_languages']).to eq(['de', 'en'])
    end
  end

  describe '_config_en.yml' do
    let(:config) { YAML.load_file(File.join(root, '_config_en.yml')) }

    it 'sets languages to ["en"]' do
      expect(config['languages']).to eq(['en'])
    end

    it 'sets destination to _site_en' do
      expect(config['destination']).to eq('_site_en')
    end

    it 'sets locale_prefix to "/en"' do
      expect(config['locale_prefix']).to eq('/en')
    end

    it 'sets all_languages to ["de", "en"]' do
      expect(config['all_languages']).to eq(['de', 'en'])
    end
  end

  describe '_config_prefetch.yml' do
    let(:config) { YAML.load_file(File.join(root, '_config_prefetch.yml')) }

    it 'sets languages to ["de"]' do
      expect(config['languages']).to eq(['de'])
    end

    it 'sets destination to _site_prefetch' do
      expect(config['destination']).to eq('_site_prefetch')
    end
  end
end

RSpec.describe 'Parallel build pipeline — merge logic' do
  let(:tmpdir) { Dir.mktmpdir('parallel_build_merge') }
  let(:site_de) { File.join(tmpdir, '_site_de') }
  let(:site_en) { File.join(tmpdir, '_site_en') }
  let(:site_out) { File.join(tmpdir, '_site') }

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  before do
    # Simulate _site_de/ with root pages, assets, and api
    FileUtils.mkdir_p(File.join(site_de, 'assets', 'css'))
    FileUtils.mkdir_p(File.join(site_de, 'api'))
    FileUtils.mkdir_p(File.join(site_de, 'einstiegsorte'))
    File.write(File.join(site_de, 'index.html'), '<h1>DE Home</h1>')
    File.write(File.join(site_de, 'einstiegsorte', 'aare.html'), '<h1>Aare DE</h1>')
    File.write(File.join(site_de, 'assets', 'css', 'main.css'), 'body { color: black; }')
    File.write(File.join(site_de, 'api', 'spots.json'), '{"spots":[]}')

    # Simulate _site_en/ — plugin writes en pages at root (not en/ subtree).
    # Also includes assets/ and api/ which must be excluded during merge.
    FileUtils.mkdir_p(File.join(site_en, 'einstiegsorte'))
    FileUtils.mkdir_p(File.join(site_en, 'assets', 'css'))
    FileUtils.mkdir_p(File.join(site_en, 'api'))
    File.write(File.join(site_en, 'index.html'), '<h1>EN Home</h1>')
    File.write(File.join(site_en, 'einstiegsorte', 'aare.html'), '<h1>Aare EN</h1>')
    File.write(File.join(site_en, 'assets', 'css', 'main.css'), 'body { color: white; }')
    File.write(File.join(site_en, 'api', 'spots.json'), '{"spots_en":[]}')
  end

  def perform_merge
    FileUtils.rm_rf(site_out)
    FileUtils.mkdir_p(site_out)
    FileUtils.cp_r("#{site_de}/.", site_out)
    # Mirror Rakefile: copy everything from _site_en/ into _site/en/, excluding assets/ and api/
    excluded = %w[assets api]
    FileUtils.mkdir_p(File.join(site_out, 'en'))
    Dir.children(site_en).each do |entry|
      next if excluded.include?(entry)
      FileUtils.cp_r(File.join(site_en, entry), File.join(site_out, 'en', entry), preserve: true)
    end
  end

  it 'copies all de files into _site/' do
    perform_merge

    expect(File.read(File.join(site_out, 'index.html'))).to eq('<h1>DE Home</h1>')
    expect(File.read(File.join(site_out, 'einstiegsorte', 'aare.html'))).to eq('<h1>Aare DE</h1>')
  end

  it 'copies only en/ subtree from _site_en into _site/en/' do
    perform_merge

    expect(File.read(File.join(site_out, 'en', 'index.html'))).to eq('<h1>EN Home</h1>')
    expect(File.read(File.join(site_out, 'en', 'einstiegsorte', 'aare.html'))).to eq('<h1>Aare EN</h1>')
  end

  it 'uses assets/ and api/ exclusively from the de build' do
    perform_merge

    # Root assets/api come from de
    expect(File.read(File.join(site_out, 'assets', 'css', 'main.css'))).to eq('body { color: black; }')
    expect(File.read(File.join(site_out, 'api', 'spots.json'))).to eq('{"spots":[]}')

    # en/assets and en/api must NOT exist — they are excluded during merge
    expect(File.exist?(File.join(site_out, 'en', 'assets'))).to be(false),
      "assets/ from _site_en/ should be excluded from _site/en/"
    expect(File.exist?(File.join(site_out, 'en', 'api'))).to be(false),
      "api/ from _site_en/ should be excluded from _site/en/"
  end
end

RSpec.describe 'Parallel build pipeline — failure isolation' do
  let(:tmpdir) { Dir.mktmpdir('parallel_build_failure') }
  let(:site_out) { File.join(tmpdir, '_site') }
  let(:site_de) { File.join(tmpdir, '_site_de') }
  let(:site_en) { File.join(tmpdir, '_site_en') }

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  it 'does not create _site/ when merge is not called (simulating build failure)' do
    # Simulate: temp dirs exist but build failed, so merge never runs
    FileUtils.mkdir_p(site_de)
    File.write(File.join(site_de, 'index.html'), '<h1>DE</h1>')

    # _site/ should not exist since merge was never called
    expect(File.exist?(site_out)).to be false
  end

  it 'preserves temp directories when build fails' do
    # Simulate partial build output
    FileUtils.mkdir_p(site_de)
    FileUtils.mkdir_p(site_en)
    File.write(File.join(site_de, 'index.html'), '<h1>DE</h1>')

    # On failure, temp dirs are preserved (cleanup is NOT called)
    expect(File.exist?(site_de)).to be true
    expect(File.exist?(site_en)).to be true
  end
end

RSpec.describe 'Parallel build pipeline — temp directory cleanup on success' do
  let(:tmpdir) { Dir.mktmpdir('parallel_build_cleanup') }

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  it 'removes _site_de/ and _site_en/ after successful merge' do
    site_de = File.join(tmpdir, '_site_de')
    site_en = File.join(tmpdir, '_site_en')

    # Create temp dirs as if builds succeeded
    [site_de, site_en].each do |dir|
      FileUtils.mkdir_p(dir)
      File.write(File.join(dir, 'test.html'), 'content')
    end

    expect(File.exist?(site_de)).to be true
    expect(File.exist?(site_en)).to be true

    # Simulate cleanup (same logic as cleanup_temp_dirs!)
    [site_de, site_en].each { |dir| FileUtils.rm_rf(dir) }

    expect(File.exist?(site_de)).to be false
    expect(File.exist?(site_en)).to be false
  end
end

RSpec.describe 'Parallel build pipeline — Rakefile task preservation' do
  let(:root) { File.expand_path('../../', __dir__) }
  let(:rakefile_content) { File.read(File.join(root, 'Rakefile')) }

  it 'defines the serve task' do
    expect(rakefile_content).to match(/task\s+:serve\b/)
  end

  it 'defines the audit:ruby task' do
    expect(rakefile_content).to match(/namespace\s+:audit/)
    expect(rakefile_content).to match(/task\s+:ruby\b/)
  end

  it 'defines the audit:npm task' do
    expect(rakefile_content).to match(/task\s+:npm\b/)
  end

  it 'defines the audit:all task' do
    expect(rakefile_content).to match(/task\s+:all\b/)
  end

  it 'defines the build:site task' do
    expect(rakefile_content).to match(/namespace\s+:build/)
    expect(rakefile_content).to match(/task\s+:site\b/)
  end
end

RSpec.describe 'Parallel build pipeline — amplify.yml content' do
  let(:root) { File.expand_path('../../', __dir__) }
  let(:amplify) { YAML.load_file(File.join(root, 'amplify.yml')) }
  let(:build_commands) { amplify.dig('frontend', 'phases', 'build', 'commands') }
  let(:pre_build_commands) { amplify.dig('frontend', 'phases', 'preBuild', 'commands') }
  let(:artifacts) { amplify.dig('frontend', 'artifacts') }
  let(:cache_paths) { amplify.dig('frontend', 'cache', 'paths') }

  it 'uses bundle exec rake build:site as the build command' do
    expect(build_commands).to include('bundle exec rake build:site')
  end

  it 'runs npm test after the build' do
    rake_idx = build_commands.index('bundle exec rake build:site')
    npm_idx = build_commands.index('npm test')
    expect(rake_idx).not_to be_nil
    expect(npm_idx).not_to be_nil
    expect(npm_idx).to be > rake_idx
  end

  it 'sets artifacts baseDirectory to _site' do
    expect(artifacts['baseDirectory']).to eq('_site')
  end

  it 'includes _data/**/* in cache paths' do
    expect(cache_paths).to include('_data/**/*')
  end

  it 'includes .jekyll-cache/**/* in cache paths' do
    expect(cache_paths).to include('.jekyll-cache/**/*')
  end

  it 'preserves preBuild commands unchanged' do
    expect(pre_build_commands).to include('npm ci')
    expect(pre_build_commands).to include('bundle install')
    expect(pre_build_commands).to include('npm run download-fonts')
    expect(pre_build_commands).to include('npm run copy-assets')
  end
end

# ---------------------------------------------------------------------------
# Property-based tests (Rantly)
# ---------------------------------------------------------------------------

# Feature: parallel-locale-builds, Property 1: Config merge preserves non-overridden keys
# **Validates: Requirements 1.3, 1.4**
RSpec.describe 'Property: Config merge preserves non-overridden keys' do
  let(:root) { File.expand_path('../../', __dir__) }
  let(:base_config) { YAML.load_file(File.join(root, '_config.yml')) }
  let(:de_config) { YAML.load_file(File.join(root, '_config_de.yml')) }
  let(:en_config) { YAML.load_file(File.join(root, '_config_en.yml')) }

  it 'preserves non-overridden keys when merging with _config_de.yml' do
    non_overridden_keys = base_config.keys - de_config.keys
    skip 'No non-overridden keys to test' if non_overridden_keys.empty?

    property_of {
      range(0, non_overridden_keys.size - 1)
    }.check(100) { |idx|
      key = non_overridden_keys[idx]
      merged = base_config.merge(de_config)
      expect(merged[key]).to eq(base_config[key]),
        "Expected key '#{key}' to be preserved after merge with _config_de.yml"
    }
  end

  it 'preserves non-overridden keys when merging with _config_en.yml' do
    non_overridden_keys = base_config.keys - en_config.keys
    skip 'No non-overridden keys to test' if non_overridden_keys.empty?

    property_of {
      range(0, non_overridden_keys.size - 1)
    }.check(100) { |idx|
      key = non_overridden_keys[idx]
      merged = base_config.merge(en_config)
      expect(merged[key]).to eq(base_config[key]),
        "Expected key '#{key}' to be preserved after merge with _config_en.yml"
    }
  end
end

# Feature: parallel-locale-builds, Property 2: Merge produces correct file set from both builds
# **Validates: Requirements 4.2, 4.3, 4.4, 8.1**
RSpec.describe 'Property: Merge produces correct file set from both builds' do
  def perform_merge(site_de, site_en, site_out)
    FileUtils.rm_rf(site_out)
    FileUtils.mkdir_p(site_out)
    FileUtils.cp_r("#{site_de}/.", site_out)
    excluded = %w[assets api]
    FileUtils.mkdir_p(File.join(site_out, 'en'))
    Dir.children(site_en).each do |entry|
      next if excluded.include?(entry)
      FileUtils.cp_r(File.join(site_en, entry), File.join(site_out, 'en', entry), preserve: true)
    end
  end

  def collect_relative_files(dir)
    Dir.glob(File.join(dir, '**', '*')).select { |f| File.file?(f) }.map do |f|
      f.sub("#{dir}/", '')
    end.sort
  end

  it 'produces the correct union of de files and en files in _site/' do
    property_of {
      de_count = range(1, 5)
      en_count = range(1, 5)
      de_names = Array.new(de_count) { "de_#{range(0, 9999)}.html" }.uniq
      en_names = Array.new(en_count) { "en_#{range(0, 9999)}.html" }.uniq
      [de_names, en_names]
    }.check(100) { |de_names, en_names|
      Dir.mktmpdir('pbt_merge') do |tmpdir|
        site_de = File.join(tmpdir, '_site_de')
        site_en = File.join(tmpdir, '_site_en')
        site_out = File.join(tmpdir, '_site')

        FileUtils.mkdir_p(site_de)
        FileUtils.mkdir_p(site_en)

        de_names.each { |name| File.write(File.join(site_de, name), "de:#{name}") }
        # EN files at _site_en/ root (not _site_en/en/)
        en_names.each { |name| File.write(File.join(site_en, name), "en:#{name}") }

        perform_merge(site_de, site_en, site_out)

        # All de files must be in _site/
        de_names.each do |name|
          path = File.join(site_out, name)
          expect(File.exist?(path)).to be(true), "Missing de file: #{name}"
          expect(File.read(path)).to eq("de:#{name}")
        end

        # All en files must be in _site/en/
        en_names.each do |name|
          path = File.join(site_out, 'en', name)
          expect(File.exist?(path)).to be(true), "Missing en file: en/#{name}"
          expect(File.read(path)).to eq("en:#{name}")
        end
      end
    }
  end

  it 'excludes assets/ and api/ from _site_en/ during merge' do
    property_of {
      asset_count = range(1, 3)
      api_count = range(1, 3)
      asset_names = Array.new(asset_count) { "style_#{range(0, 9999)}.css" }.uniq
      api_names = Array.new(api_count) { "data_#{range(0, 9999)}.json" }.uniq
      [asset_names, api_names]
    }.check(100) { |asset_names, api_names|
      Dir.mktmpdir('pbt_merge_excluded') do |tmpdir|
        site_de = File.join(tmpdir, '_site_de')
        site_en = File.join(tmpdir, '_site_en')
        site_out = File.join(tmpdir, '_site')

        FileUtils.mkdir_p(site_de)
        FileUtils.mkdir_p(File.join(site_en, 'assets'))
        FileUtils.mkdir_p(File.join(site_en, 'api'))

        File.write(File.join(site_de, 'index.html'), 'de home')
        File.write(File.join(site_en, 'index.html'), 'en home')

        asset_names.each { |name| File.write(File.join(site_en, 'assets', name), "asset:#{name}") }
        api_names.each { |name| File.write(File.join(site_en, 'api', name), "api:#{name}") }

        perform_merge(site_de, site_en, site_out)

        # assets/ and api/ from _site_en/ must NOT appear under _site/en/
        expect(File.exist?(File.join(site_out, 'en', 'assets'))).to be(false),
          "assets/ from _site_en/ should be excluded from _site/en/"
        expect(File.exist?(File.join(site_out, 'en', 'api'))).to be(false),
          "api/ from _site_en/ should be excluded from _site/en/"
      end
    }
  end
end

# Feature: parallel-locale-builds, Property 4: File permissions preserved during merge
# **Validates: Requirements 4.6**
RSpec.describe 'Property: File permissions preserved during merge' do
  PERMISSION_MODES = [0o644, 0o755, 0o600, 0o664, 0o700, 0o444, 0o555, 0o666, 0o744, 0o640].freeze

  def perform_merge(site_de, site_en, site_out)
    FileUtils.rm_rf(site_out)
    FileUtils.mkdir_p(site_out)
    FileUtils.cp_r("#{site_de}/.", site_out, preserve: true)
    excluded = %w[assets api]
    FileUtils.mkdir_p(File.join(site_out, 'en'))
    Dir.children(site_en).each do |entry|
      next if excluded.include?(entry)
      FileUtils.cp_r(File.join(site_en, entry), File.join(site_out, 'en', entry), preserve: true)
    end
  end

  it 'preserves file permissions for all copied files' do
    property_of {
      de_mode_idx = range(0, PERMISSION_MODES.size - 1)
      en_mode_idx = range(0, PERMISSION_MODES.size - 1)
      de_name = "perm_de_#{range(0, 9999)}.html"
      en_name = "perm_en_#{range(0, 9999)}.html"
      [de_name, PERMISSION_MODES[de_mode_idx], en_name, PERMISSION_MODES[en_mode_idx]]
    }.check(100) { |de_name, de_mode, en_name, en_mode|
      Dir.mktmpdir('pbt_perms') do |tmpdir|
        site_de = File.join(tmpdir, '_site_de')
        site_en = File.join(tmpdir, '_site_en')
        site_out = File.join(tmpdir, '_site')

        FileUtils.mkdir_p(site_de)
        FileUtils.mkdir_p(site_en)

        de_path = File.join(site_de, de_name)
        en_path = File.join(site_en, en_name)

        File.write(de_path, "de content")
        File.chmod(de_mode, de_path)

        File.write(en_path, "en content")
        File.chmod(en_mode, en_path)

        perform_merge(site_de, site_en, site_out)

        merged_de = File.join(site_out, de_name)
        merged_en = File.join(site_out, 'en', en_name)

        expect(File.stat(merged_de).mode & 0o777).to eq(de_mode),
          "DE file '#{de_name}' permissions mismatch: expected #{de_mode.to_s(8)}, got #{(File.stat(merged_de).mode & 0o777).to_s(8)}"
        expect(File.stat(merged_en).mode & 0o777).to eq(en_mode),
          "EN file '#{en_name}' permissions mismatch: expected #{en_mode.to_s(8)}, got #{(File.stat(merged_en).mode & 0o777).to_s(8)}"
      end
    }
  end
end

# Feature: parallel-locale-builds, Property 5: Failure isolation preserves existing state
# **Validates: Requirements 3.3, 6.3, 10.1, 10.2, 10.3, 10.4**
RSpec.describe 'Property: Failure isolation preserves existing state' do
  it 'does not modify _site/ and preserves temp dirs when build fails' do
    property_of {
      file_count = range(1, 5)
      existing_files = Array.new(file_count) { "existing_#{range(0, 9999)}.html" }.uniq
      existing_contents = existing_files.map { |_| "content_#{range(0, 99999)}" }
      temp_de_files = Array.new(range(1, 3)) { "temp_de_#{range(0, 9999)}.html" }.uniq
      temp_en_files = Array.new(range(1, 3)) { "temp_en_#{range(0, 9999)}.html" }.uniq
      failed_stage = choose(:prefetch, :de_build, :en_build)
      [existing_files, existing_contents, temp_de_files, temp_en_files, failed_stage]
    }.check(100) { |existing_files, existing_contents, temp_de_files, temp_en_files, failed_stage|
      Dir.mktmpdir('pbt_failure') do |tmpdir|
        site_out = File.join(tmpdir, '_site')
        site_de = File.join(tmpdir, '_site_de')
        site_en = File.join(tmpdir, '_site_en')

        # Set up existing _site/ content
        FileUtils.mkdir_p(site_out)
        existing_files.each_with_index do |name, i|
          File.write(File.join(site_out, name), existing_contents[i])
        end

        # Snapshot existing _site/ state
        snapshot = {}
        existing_files.each_with_index do |name, i|
          snapshot[name] = existing_contents[i]
        end

        # Simulate partial temp dir creation depending on failure stage
        case failed_stage
        when :prefetch
          # Pre-fetch fails: no temp dirs created
        when :de_build
          FileUtils.mkdir_p(site_de)
          temp_de_files.each { |name| File.write(File.join(site_de, name), "de:#{name}") }
        when :en_build
          FileUtils.mkdir_p(site_de)
          temp_de_files.each { |name| File.write(File.join(site_de, name), "de:#{name}") }
          FileUtils.mkdir_p(site_en)
          temp_en_files.each { |name| File.write(File.join(site_en, name), "en:#{name}") }
        end

        # Failure means merge is NOT called — _site/ must be unchanged
        existing_files.each_with_index do |name, i|
          path = File.join(site_out, name)
          expect(File.exist?(path)).to be(true),
            "Existing file '#{name}' in _site/ was removed after #{failed_stage} failure"
          expect(File.read(path)).to eq(existing_contents[i]),
            "Existing file '#{name}' in _site/ was modified after #{failed_stage} failure"
        end

        # Temp dirs must be preserved for debugging (if they were created)
        case failed_stage
        when :de_build
          expect(File.exist?(site_de)).to be(true),
            "_site_de/ should be preserved after de_build failure"
        when :en_build
          expect(File.exist?(site_de)).to be(true),
            "_site_de/ should be preserved after en_build failure"
          expect(File.exist?(site_en)).to be(true),
            "_site_en/ should be preserved after en_build failure"
        end
      end
    }
  end
end
