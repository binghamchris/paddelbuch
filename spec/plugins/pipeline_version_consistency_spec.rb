# frozen_string_literal: true

# Feature: dependency-version-upgrade, Property 2: Pipeline Version Consistency
# **Validates: Requirements 2.3, 8.1**

require 'spec_helper'
require 'yaml'
require 'tmpdir'

RSpec.describe 'Pipeline Version Consistency — Property 2' do
  # Helpers to parse version strings from project files

  def parse_ruby_version_file(content)
    # .ruby-version format: "ruby-X.Y.Z" — extract the numeric version
    match = content.strip.match(/\Aruby-(\d+\.\d+\.\d+)\z/)
    match ? match[1] : nil
  end

  def parse_amplify_rvm_versions(yaml_content)
    amplify = YAML.safe_load(yaml_content)
    commands = amplify.dig('frontend', 'phases', 'preBuild', 'commands') || []

    rvm_install_version = nil
    rvm_use_version = nil

    commands.each do |cmd|
      if (m = cmd.to_s.match(/\Arvm install (\S+)\z/))
        rvm_install_version = m[1]
      end
      if (m = cmd.to_s.match(/\Arvm use (\S+)\z/))
        rvm_use_version = m[1]
      end
    end

    { install: rvm_install_version, use: rvm_use_version }
  end

  # --- Property test: random version strings ---
  describe 'parsing and matching logic with random versions' do
    it 'correctly round-trips any valid Ruby version through .ruby-version and amplify.yml formats' do
      property_of {
        Rantly {
          major = range(2, 4)
          minor = range(0, 15)
          patch = range(0, 30)
          version = "#{major}.#{minor}.#{patch}"
          version
        }
      }.check(100) { |version|
        # Simulate .ruby-version content
        ruby_version_content = "ruby-#{version}"
        parsed_version = parse_ruby_version_file(ruby_version_content)
        expect(parsed_version).to eq(version),
          "Failed to parse version from .ruby-version content '#{ruby_version_content}'"

        # Simulate amplify.yml content with matching rvm commands
        amplify_content = {
          'version' => 1,
          'frontend' => {
            'phases' => {
              'preBuild' => {
                'commands' => [
                  "nvm install 18",
                  "npm ci",
                  "rvm install #{version}",
                  "rvm use #{version}",
                  "bundle install"
                ]
              }
            }
          }
        }.to_yaml

        rvm_versions = parse_amplify_rvm_versions(amplify_content)

        # Both rvm commands must reference the same version as .ruby-version
        expect(rvm_versions[:install]).to eq(parsed_version),
          "rvm install version '#{rvm_versions[:install]}' does not match .ruby-version '#{parsed_version}'"
        expect(rvm_versions[:use]).to eq(parsed_version),
          "rvm use version '#{rvm_versions[:use]}' does not match .ruby-version '#{parsed_version}'"
      }
    end
  end

  # --- Concrete test: actual project files ---
  describe 'actual project files consistency' do
    let(:project_root) { File.expand_path('../../', __dir__) }
    let(:ruby_version_path) { File.join(project_root, '.ruby-version') }
    let(:amplify_yml_path) { File.join(project_root, 'amplify.yml') }

    it 'has .ruby-version, rvm install, and rvm use all referencing the same version' do
      ruby_version_content = File.read(ruby_version_path)
      parsed_version = parse_ruby_version_file(ruby_version_content)
      expect(parsed_version).not_to be_nil, "Could not parse version from .ruby-version: '#{ruby_version_content.strip}'"

      amplify_content = File.read(amplify_yml_path)
      rvm_versions = parse_amplify_rvm_versions(amplify_content)

      expect(rvm_versions[:install]).to eq(parsed_version),
        "amplify.yml 'rvm install #{rvm_versions[:install]}' does not match .ruby-version '#{parsed_version}'"
      expect(rvm_versions[:use]).to eq(parsed_version),
        "amplify.yml 'rvm use #{rvm_versions[:use]}' does not match .ruby-version '#{parsed_version}'"
    end
  end

  # --- Property test: detect mismatches ---
  describe 'mismatch detection' do
    it 'detects when rvm install version differs from .ruby-version' do
      property_of {
        Rantly {
          major = range(2, 4)
          minor = range(0, 15)
          patch = range(0, 30)
          correct_version = "#{major}.#{minor}.#{patch}"

          # Generate a different version for the mismatch
          wrong_patch = patch + 1
          wrong_version = "#{major}.#{minor}.#{wrong_patch}"

          { correct: correct_version, wrong: wrong_version }
        }
      }.check(100) { |data|
        parsed_version = parse_ruby_version_file("ruby-#{data[:correct]}")

        # Simulate amplify.yml with mismatched rvm install
        amplify_content = {
          'version' => 1,
          'frontend' => {
            'phases' => {
              'preBuild' => {
                'commands' => [
                  "rvm install #{data[:wrong]}",
                  "rvm use #{data[:correct]}",
                  "bundle install"
                ]
              }
            }
          }
        }.to_yaml

        rvm_versions = parse_amplify_rvm_versions(amplify_content)

        # The install version should NOT match the parsed version
        expect(rvm_versions[:install]).not_to eq(parsed_version),
          "Expected mismatch but versions matched: #{rvm_versions[:install]}"
      }
    end
  end
end
