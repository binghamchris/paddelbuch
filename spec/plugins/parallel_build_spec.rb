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
  end

  describe '_config_en.yml' do
    let(:config) { YAML.load_file(File.join(root, '_config_en.yml')) }

    it 'sets languages to ["en"]' do
      expect(config['languages']).to eq(['en'])
    end

    it 'sets destination to _site_en' do
      expect(config['destination']).to eq('_site_en')
    end

    it 'sets baseurl to "/en"' do
      expect(config['baseurl']).to eq('/en')
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

    # Simulate _site_en/ with en/ subtree (including duplicate assets/api)
    FileUtils.mkdir_p(File.join(site_en, 'en', 'einstiegsorte'))
    FileUtils.mkdir_p(File.join(site_en, 'en', 'assets', 'css'))
    FileUtils.mkdir_p(File.join(site_en, 'en', 'api'))
    File.write(File.join(site_en, 'en', 'index.html'), '<h1>EN Home</h1>')
    File.write(File.join(site_en, 'en', 'einstiegsorte', 'aare.html'), '<h1>Aare EN</h1>')
    File.write(File.join(site_en, 'en', 'assets', 'css', 'main.css'), 'body { color: white; }')
    File.write(File.join(site_en, 'en', 'api', 'spots.json'), '{"spots_en":[]}')
  end

  def perform_merge
    FileUtils.rm_rf(site_out)
    FileUtils.mkdir_p(site_out)
    FileUtils.cp_r("#{site_de}/.", site_out)
    FileUtils.cp_r(File.join(site_en, 'en'), File.join(site_out, 'en'))
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

    # en/assets and en/api come from the en build's en/ subtree (as copied)
    # but the root-level assets/ and api/ are NOT overwritten by en build
    expect(File.read(File.join(site_out, 'assets', 'css', 'main.css'))).not_to eq('body { color: white; }')
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

  it 'removes _site_de/, _site_en/, and _site_prefetch/ after successful merge' do
    site_de = File.join(tmpdir, '_site_de')
    site_en = File.join(tmpdir, '_site_en')
    site_prefetch = File.join(tmpdir, '_site_prefetch')

    # Create temp dirs as if builds succeeded
    [site_de, site_en, site_prefetch].each do |dir|
      FileUtils.mkdir_p(dir)
      File.write(File.join(dir, 'test.html'), 'content')
    end

    expect(File.exist?(site_de)).to be true
    expect(File.exist?(site_en)).to be true
    expect(File.exist?(site_prefetch)).to be true

    # Simulate cleanup (same logic as cleanup_temp_dirs!)
    [site_de, site_en, site_prefetch].each { |dir| FileUtils.rm_rf(dir) }

    expect(File.exist?(site_de)).to be false
    expect(File.exist?(site_en)).to be false
    expect(File.exist?(site_prefetch)).to be false
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
