# frozen_string_literal: true

require 'spec_helper'
require 'yaml'
require 'json'
require 'open3'

RSpec.describe 'Amplify Bundler version consistency' do
  AMPLIFY_APP_ID = 'd1yyy5ru04e86p'
  AWS_PROFILE = 'paddelbuch-dev'
  AWS_REGION = 'eu-central-1'

  let(:gemfile_lock_path) { File.join(File.dirname(__FILE__), '..', '..', 'Gemfile.lock') }

  def bundler_version_from_gemfile_lock
    content = File.read(gemfile_lock_path)
    # The BUNDLED WITH section is at the end of Gemfile.lock:
    #   BUNDLED WITH
    #      2.6.2
    match = content.match(/BUNDLED WITH\n\s+(\S+)/)
    raise "Could not parse BUNDLED WITH from Gemfile.lock" unless match

    match[1]
  end

  def fetch_build_spec
    cmd = [
      'aws', 'amplify', 'get-app',
      '--app-id', AMPLIFY_APP_ID,
      '--profile', AWS_PROFILE,
      '--region', AWS_REGION,
      '--output', 'json'
    ]

    stdout, stderr, status = Open3.capture3(*cmd)
    raise "AWS CLI failed (exit #{status.exitstatus}): #{stderr}" unless status.success?

    app_data = JSON.parse(stdout)
    build_spec_yaml = app_data.dig('app', 'buildSpec')
    raise "No buildSpec found in Amplify app response" unless build_spec_yaml

    build_spec_yaml
  end

  def bundler_version_from_build_spec(build_spec_yaml)
    # Parse the buildSpec YAML and find `gem install bundler:X.Y.Z` in preBuild commands
    build_spec = YAML.safe_load(build_spec_yaml)
    pre_build_commands = build_spec.dig('frontend', 'phases', 'preBuild', 'commands') || []

    gem_install_cmd = pre_build_commands.find { |cmd| cmd.match?(/gem install bundler:/) }
    raise "No 'gem install bundler:' command found in preBuild phase" unless gem_install_cmd

    match = gem_install_cmd.match(/gem install bundler:(\S+)/)
    raise "Could not parse Bundler version from command: #{gem_install_cmd}" unless match

    match[1]
  end

  it 'has matching Bundler version in buildSpec and Gemfile.lock' do
    lock_version = bundler_version_from_gemfile_lock
    expect(lock_version).not_to be_nil
    expect(lock_version).to match(/\A\d+\.\d+\.\d+\z/)

    build_spec_yaml = fetch_build_spec
    spec_version = bundler_version_from_build_spec(build_spec_yaml)
    expect(spec_version).not_to be_nil

    expect(spec_version).to eq(lock_version),
      "Bundler version mismatch: buildSpec has #{spec_version} but Gemfile.lock has #{lock_version}"
  end

  it 'has a valid BUNDLED WITH section in Gemfile.lock' do
    version = bundler_version_from_gemfile_lock
    expect(version).to match(/\A\d+\.\d+\.\d+\z/),
      "Expected a valid semver version in Gemfile.lock BUNDLED WITH, got: #{version}"
  end

  it 'has gem install bundler command before bundle install in preBuild' do
    build_spec_yaml = fetch_build_spec
    build_spec = YAML.safe_load(build_spec_yaml)
    pre_build_commands = build_spec.dig('frontend', 'phases', 'preBuild', 'commands') || []

    gem_install_index = pre_build_commands.index { |cmd| cmd.match?(/gem install bundler:/) }
    bundle_install_index = pre_build_commands.index { |cmd| cmd.strip == 'bundle install' }

    expect(gem_install_index).not_to be_nil, "Expected 'gem install bundler:' in preBuild commands"
    expect(bundle_install_index).not_to be_nil, "Expected 'bundle install' in preBuild commands"
    expect(gem_install_index).to be < bundle_install_index,
      "Expected 'gem install bundler:' (index #{gem_install_index}) to come before 'bundle install' (index #{bundle_install_index})"
  end
end
