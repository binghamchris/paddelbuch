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

  def parse_dockerfile_ruby_version(content)
    # Dockerfile downloads ruby-X.Y.Z.tar.gz — extract the version
    match = content.match(/ruby-(\d+\.\d+\.\d+)\.tar\.gz/)
    match ? match[1] : nil
  end

  # --- Property test: random version strings ---
  describe 'parsing and matching logic with random versions' do
    it 'correctly round-trips any valid Ruby version through .ruby-version and Dockerfile formats' do
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

        # Simulate Dockerfile content with matching Ruby source download
        dockerfile_content = <<~DOCKERFILE
          FROM amazonlinux:2023
          RUN curl -fsSL https://cache.ruby-lang.org/pub/ruby/#{version.split('.')[0..1].join('.')}/ruby-#{version}.tar.gz -o /tmp/ruby.tar.gz
        DOCKERFILE

        dockerfile_version = parse_dockerfile_ruby_version(dockerfile_content)

        expect(dockerfile_version).to eq(parsed_version),
          "Dockerfile Ruby version '#{dockerfile_version}' does not match .ruby-version '#{parsed_version}'"
      }
    end
  end

  # --- Concrete test: actual project files ---
  describe 'actual project files consistency' do
    let(:project_root) { File.expand_path('../../', __dir__) }
    let(:ruby_version_path) { File.join(project_root, '.ruby-version') }
    let(:dockerfile_path) { File.join(project_root, 'infrastructure', 'Dockerfile') }

    it 'has .ruby-version and Dockerfile Ruby source download referencing the same version' do
      ruby_version_content = File.read(ruby_version_path)
      parsed_version = parse_ruby_version_file(ruby_version_content)
      expect(parsed_version).not_to be_nil, "Could not parse version from .ruby-version: '#{ruby_version_content.strip}'"

      dockerfile_content = File.read(dockerfile_path)
      dockerfile_version = parse_dockerfile_ruby_version(dockerfile_content)

      expect(dockerfile_version).to eq(parsed_version),
        "Dockerfile Ruby version '#{dockerfile_version}' does not match .ruby-version '#{parsed_version}'"
    end
  end

  # --- Property test: detect mismatches ---
  describe 'mismatch detection' do
    it 'detects when Dockerfile Ruby version differs from .ruby-version' do
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

        # Simulate Dockerfile with mismatched Ruby version
        dockerfile_content = <<~DOCKERFILE
          FROM amazonlinux:2023
          RUN curl -fsSL https://cache.ruby-lang.org/pub/ruby/3.4/ruby-#{data[:wrong]}.tar.gz -o /tmp/ruby.tar.gz
        DOCKERFILE

        dockerfile_version = parse_dockerfile_ruby_version(dockerfile_content)

        # The Dockerfile version should NOT match the parsed version
        expect(dockerfile_version).not_to eq(parsed_version),
          "Expected mismatch but versions matched: #{dockerfile_version}"
      }
    end
  end
end
