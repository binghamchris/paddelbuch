# frozen_string_literal: true

require 'spec_helper'

# Feature: detail-close-button
# Validates: Requirements 1.1, 1.2, 1.10, 4.2
#
# Wiring only: each details layout includes the close button exactly once, with
# its own page type, after setting locale_prefix. Spot pages place it inline at
# the right of the spot type row and put the Navigate button in the title row;
# the other layouts give it its own row as the first element of the pane. What
# the include renders is covered by detail_close_btn_spec.rb.
RSpec.describe 'details layouts wire the close button' do
  layouts_dir = File.join(__dir__, '..', '_layouts')
  include_pattern = /\{%-?\s*include\s+detail-close-btn\.html\s+page_type="([^"]*)"(\s+inline=true)?\s*-?%\}/

  def read_layout(dir, name)
    File.read(File.join(dir, name))
  end

  # The markup of the first <div> carrying css_class, from its opening tag to
  # its matching closing tag (nested divs balanced).
  def div_block(source, css_class)
    open = source.match(/<div\b[^>]*class="[^"]*\b#{Regexp.escape(css_class)}\b[^"]*"[^>]*>/)
    return nil unless open

    depth = 1
    pos = open.end(0)
    while depth.positive?
      next_open = source.index(/<div\b/, pos)
      next_close = source.index(%r{</div>}, pos)
      return nil unless next_close

      if next_open && next_open < next_close
        depth += 1
        pos = next_open + 4
      else
        depth -= 1
        pos = next_close + 6
      end
    end
    source[open.begin(0)...pos]
  end

  {
    'spot.html' => 'spot',
    'waterway.html' => 'waterway',
    'obstacle.html' => 'obstacle',
    'notice.html' => 'notice'
  }.each do |layout, page_type|
    describe layout do
      let(:source) { read_layout(layouts_dir, layout) }

      it "includes the close button exactly once with page_type=\"#{page_type}\"" do
        expect(source.scan(include_pattern).map(&:first)).to eq([page_type])
      end

      it 'sets locale_prefix before the close button include' do
        prefix_at = source.index(/\{%-?\s*include\s+locale-prefix\.html\s*-?%\}/)
        expect(prefix_at).not_to be_nil
        expect(prefix_at).to be < source.index(include_pattern)
      end
    end
  end

  describe 'spot.html header rows' do
    let(:source) { read_layout(layouts_dir, 'spot.html') }
    let(:type_row) { div_block(source, 'spot-icon-div') }
    let(:title_row) { div_block(source, 'spot-title') }

    it 'puts the close button inline in the spot type row, after the type label' do
      expect(type_row).not_to be_nil
      call = type_row.match(include_pattern)
      expect(call).not_to be_nil
      expect(call[2]).not_to be_nil, 'the spot layout must pass inline=true'
      expect(type_row.index('spot-icon.html')).to be < call.begin(0)
      expect(type_row.index('spot_type_name')).to be < call.begin(0)
    end

    it 'puts the Navigate button in the title row, after the title' do
      expect(title_row).not_to be_nil
      expect(title_row).to match(/<h1>/)
      expect(title_row.index('navigate-btn.html')).not_to be_nil
      expect(title_row.index('<h1>')).to be < title_row.index('navigate-btn.html')
    end

    it 'has no Navigate button outside the title row' do
      expect(source.scan('navigate-btn.html').length).to eq(1)
    end

    it 'opens the pane with the spot type row' do
      pane_open = source.match(/<div\b[^>]*class="[^"]*\bspot-description\b[^"]*"[^>]*>/)
      between = source[pane_open.end(0)...source.index(type_row)]
      expect(between.gsub(/<!--.*?-->/m, '').strip).to be_empty
    end
  end

  {
    'waterway.html' => 'waterway-details',
    'obstacle.html' => 'obstacle-description',
    'notice.html' => 'notice-description'
  }.each do |layout, pane_class|
    describe "#{layout} close row" do
      let(:source) { read_layout(layouts_dir, layout) }

      it 'uses the row variant (no inline=true)' do
        expect(source.match(include_pattern)[2]).to be_nil
      end

      it "places the close button first inside the .#{pane_class} pane" do
        pane_open = source.match(/<div\b[^>]*class="[^"]*\b#{Regexp.escape(pane_class)}\b[^"]*"[^>]*>/)
        expect(pane_open).not_to be_nil

        between = source[pane_open.end(0)...source.index(include_pattern)]
        expect(between.gsub(/<!--.*?-->/m, '').strip).to be_empty
      end
    end
  end
end
