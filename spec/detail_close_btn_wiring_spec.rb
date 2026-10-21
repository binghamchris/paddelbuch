# frozen_string_literal: true

require 'spec_helper'

# Feature: detail-close-button
# Validates: Requirements 1.1, 1.2, 4.2
#
# Wiring only: each details layout includes the close button exactly once, with
# its own page type, as the first element of its details pane, after setting
# locale_prefix. What the include renders is covered by detail_close_btn_spec.rb.
RSpec.describe 'details layouts wire the close button' do
  layouts_dir = File.join(__dir__, '..', '_layouts')

  {
    'spot.html' => ['spot', 'spot-description'],
    'waterway.html' => ['waterway', 'waterway-details'],
    'obstacle.html' => ['obstacle', 'obstacle-description'],
    'notice.html' => ['notice', 'notice-description']
  }.each do |layout, (page_type, pane_class)|
    describe layout do
      let(:source) { File.read(File.join(layouts_dir, layout)) }
      let(:include_pattern) { /\{%-?\s*include\s+detail-close-btn\.html\s+page_type="([^"]*)"\s*-?%\}/ }

      it "includes the close button exactly once with page_type=\"#{page_type}\"" do
        expect(source.scan(include_pattern)).to eq([[page_type]])
      end

      it 'sets locale_prefix before the close button include' do
        prefix_at = source.index(/\{%-?\s*include\s+locale-prefix\.html\s*-?%\}/)
        button_at = source.index(include_pattern)
        expect(prefix_at).not_to be_nil
        expect(prefix_at).to be < button_at
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
