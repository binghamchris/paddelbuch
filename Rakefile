require 'jekyll'
require 'fileutils'

TEMP_DIRS = %w[_site_de _site_en _site_prefetch].freeze

# ---------------------------------------------------------------------------
# Helper methods for the parallel build pipeline
# ---------------------------------------------------------------------------

def prefetch_and_validate!
  puts "==> Pre-fetching Contentful data..."
  success = system("bundle exec jekyll build --config _config.yml,_config_prefetch.yml")
  unless success
    abort "[prefetch] Pre-fetch build failed (exit #{$?.exitstatus}). Aborting."
  end
  FileUtils.rm_rf('_site_prefetch')
  puts "==> Pre-fetch complete."
end

def run_parallel_builds!
  puts "==> Starting parallel locale builds..."

  builds = {
    'de' => 'bundle exec jekyll build --config _config.yml,_config_de.yml',
    'en' => 'bundle exec jekyll build --config _config.yml,_config_en.yml'
  }

  pids = {}
  readers = []

  builds.each do |locale, cmd|
    out_r, out_w = IO.pipe
    err_r, err_w = IO.pipe

    pid = Process.spawn(cmd, out: out_w, err: err_w)
    out_w.close
    err_w.close

    pids[locale] = pid

    readers << Thread.new(out_r, locale) do |io, loc|
      io.each_line { |line| $stdout.puts "[#{loc}] #{line}" }
    end
    readers << Thread.new(err_r, locale) do |io, loc|
      io.each_line { |line| $stderr.puts "[#{loc}] #{line}" }
    end
  end

  # Collect exit statuses
  statuses = {}
  pids.each do |locale, pid|
    _, status = Process.waitpid2(pid)
    statuses[locale] = status
  end

  readers.each(&:join)

  # Check for failures
  failures = statuses.select { |_, s| !s.success? }
  unless failures.empty?
    failures.each do |locale, status|
      $stderr.puts "[#{locale}] Build failed with exit status #{status.exitstatus}."
    end
    abort "Parallel build failed. Temp dirs (_site_de/, _site_en/) preserved for debugging."
  end

  puts "==> Both locale builds succeeded."
end

def merge_outputs!
  puts "==> Merging build outputs into _site/..."
  FileUtils.rm_rf('_site')
  FileUtils.mkdir_p('_site')

  # Copy all de output (root pages, assets, api) as the base
  FileUtils.cp_r('_site_de/.', '_site', preserve: true)

  # Copy en output into _site/en/, excluding locale-independent paths.
  # The plugin treats "en" as default_lang (languages.first), so en pages
  # land at _site_en/ root — not _site_en/en/. We copy everything except
  # assets/ and api/ (which come from the de build).
  excluded = %w[assets api]
  FileUtils.mkdir_p('_site/en')
  Dir.children('_site_en').each do |entry|
    next if excluded.include?(entry)
    FileUtils.cp_r(File.join('_site_en', entry), File.join('_site', 'en', entry), preserve: true)
  end

  puts "==> Merge complete."
end

def cleanup_temp_dirs!
  TEMP_DIRS.each { |dir| FileUtils.rm_rf(dir) }
  puts "==> Temporary directories cleaned up."
end

# ---------------------------------------------------------------------------
# Rake tasks
# ---------------------------------------------------------------------------

namespace :build do
  desc "Build the Jekyll site (parallel locale builds)"
  task :site do
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    prefetch_and_validate!
    run_parallel_builds!
    merge_outputs!
    cleanup_temp_dirs!

    elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time
    puts "Build complete in #{elapsed.round(1)}s"
  end
end

desc "Start Jekyll development server"
task :serve do
  puts "Starting Jekyll development server..."
  Jekyll::Commands::Serve.process({})
end

task :default => 'build:site'

namespace :audit do
  desc "Scan Ruby gems for known vulnerabilities"
  task :ruby do
    puts "Scanning Ruby gems for vulnerabilities..."
    success = system("bundle-audit check --update")
    if success
      puts "No known vulnerabilities found in Ruby gems."
    else
      abort "Ruby gem vulnerabilities detected!"
    end
  end

  desc "Scan npm packages for known vulnerabilities"
  task :npm do
    puts "Scanning npm packages for vulnerabilities..."
    success = system("npm audit --audit-level=moderate")
    if success
      puts "No known vulnerabilities found in npm packages."
    else
      abort "npm package vulnerabilities detected!"
    end
  end

  desc "Scan all dependencies (Ruby + npm) for vulnerabilities"
  task :all => [:ruby, :npm]
end

desc "Scan Ruby gems for known vulnerabilities"
task :audit => 'audit:ruby'
