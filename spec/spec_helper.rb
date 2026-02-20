require 'rspec'
require 'rantly'
require 'rantly/rspec_extensions'
require 'jekyll'
require 'contentful'

# Require plugin files from _plugins/ directory
# Some plugins may depend on gems or classes not available in the test environment
# (e.g., contentful_mappers.rb depends on jekyll-contentful-data-import Base class
# until it is refactored). We load what we can and skip the rest gracefully.
Dir[File.join(File.dirname(__FILE__), '..', '_plugins', '*.rb')].sort.each do |file|
  begin
    require file
  rescue NameError, LoadError => e
    warn "spec_helper: skipping #{File.basename(file)} (#{e.message})"
  end
end

RSpec.configure do |config|
  # Enable focused filtering (run only :focus tagged examples with `bundle exec rspec`)
  config.filter_run_when_matching :focus

  # Use documentation formatter for readable output
  config.formatter = :documentation

  # Run specs in random order to surface order dependencies
  config.order = :random
  Kernel.srand config.seed

  # Expect the newer `expect` syntax rather than `should`
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
    expectations.syntax = :expect
  end

  # Configure mocking framework
  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  # Shared context for temporary directories used in cache/file tests
  config.shared_context_metadata_behavior = :apply_to_host_groups
end
