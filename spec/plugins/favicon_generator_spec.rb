# frozen_string_literal: true

# Tests for Paddelbuch::FaviconGenerator and Paddelbuch::AliasedStaticFile
# **Validates: Requirements 2.9**

require 'spec_helper'
require 'tmpdir'
require 'fileutils'

RSpec.describe Paddelbuch::FaviconGenerator do
  let(:generator) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:static_files) { [] }
  let(:site) do
    s = double('Jekyll::Site')
    allow(s).to receive(:source).and_return(tmpdir)
    allow(s).to receive(:static_files).and_return(static_files)
    allow(s).to receive(:dest).and_return(File.join(tmpdir, '_site'))
    allow(s).to receive(:config).and_return({})
    allow(s).to receive(:frontmatter_defaults).and_return(
      double('FrontmatterDefaults').tap do |fd|
        allow(fd).to receive(:all).and_return({})
        allow(fd).to receive(:find).and_return(nil)
      end
    )
    allow(s).to receive(:theme).and_return(nil)
    allow(s).to receive(:in_theme_dir) { |*args| args.compact.first }
    s
  end

  before do
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  describe 'SVG favicon' do
    context 'when SVG source exists' do
      before do
        svg_dir = File.join(tmpdir, 'assets', 'images')
        FileUtils.mkdir_p(svg_dir)
        File.write(File.join(svg_dir, 'logo-favicon.svg'), '<svg></svg>')
      end

      it 'adds an AliasedStaticFile with destination favicon.ico' do
        generator.generate(site)

        favicon = static_files.find { |f| f.destination(tmpdir) == File.join(tmpdir, 'favicon.ico') }
        expect(favicon).not_to be_nil
        expect(favicon).to be_a(Paddelbuch::AliasedStaticFile)
      end
    end

    context 'when SVG source does not exist' do
      it 'does not add a favicon.ico static file' do
        generator.generate(site)

        favicon = static_files.find { |f| f.destination(tmpdir) == File.join(tmpdir, 'favicon.ico') }
        expect(favicon).to be_nil
      end
    end
  end

  describe 'PNG Apple Touch Icon' do
    context 'when PNG source exists' do
      before do
        png_dir = File.join(tmpdir, 'assets', 'images')
        FileUtils.mkdir_p(png_dir)
        File.write(File.join(png_dir, 'apple-touch-icon.png'), 'PNG_DATA')
      end

      it 'adds an AliasedStaticFile with destination apple-touch-icon.png' do
        generator.generate(site)

        icon = static_files.find { |f| f.destination(tmpdir) == File.join(tmpdir, 'apple-touch-icon.png') }
        expect(icon).not_to be_nil
        expect(icon).to be_a(Paddelbuch::AliasedStaticFile)
      end
    end

    context 'when PNG source does not exist' do
      it 'does not add an apple-touch-icon.png static file and logs a warning' do
        generator.generate(site)

        icon = static_files.find { |f| f.destination(tmpdir) == File.join(tmpdir, 'apple-touch-icon.png') }
        expect(icon).to be_nil
        expect(Jekyll.logger).to have_received(:warn).with('Favicon:', a_string_matching(/Apple Touch Icon not found/))
      end
    end
  end
end

RSpec.describe Paddelbuch::AliasedStaticFile do
  let(:tmpdir) { Dir.mktmpdir }
  let(:site) do
    s = double('Jekyll::Site')
    allow(s).to receive(:source).and_return(tmpdir)
    allow(s).to receive(:dest).and_return(File.join(tmpdir, '_site'))
    allow(s).to receive(:config).and_return({})
    allow(s).to receive(:frontmatter_defaults).and_return(
      double('FrontmatterDefaults').tap do |fd|
        allow(fd).to receive(:all).and_return({})
        allow(fd).to receive(:find).and_return(nil)
      end
    )
    allow(s).to receive(:theme).and_return(nil)
    allow(s).to receive(:in_theme_dir) { |*args| args.compact.first }
    s
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  describe '#path' do
    it 'returns the original source file path' do
      source_path = File.join(tmpdir, 'assets', 'images', 'logo-favicon.svg')
      aliased = described_class.new(site, source_path, 'favicon.ico')

      expect(aliased.path).to eq(source_path)
    end
  end

  describe '#destination' do
    it 'returns File.join(dest, dest_name)' do
      source_path = File.join(tmpdir, 'assets', 'images', 'logo-favicon.svg')
      aliased = described_class.new(site, source_path, 'favicon.ico')

      dest = '/output/site'
      expect(aliased.destination(dest)).to eq(File.join(dest, 'favicon.ico'))
    end
  end
end
