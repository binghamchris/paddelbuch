"""
Preservation Property Tests: Existing External Script Behavior Unchanged

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

Property 2: Preservation - Existing External Script Behavior Unchanged

For any page load after the fix is applied, the runtime JavaScript behavior
SHALL be identical to the pre-fix behavior — detail pages continue to use
#map-config JSON + external paddelbuch-map.js, script loading order is
preserved, layer-styles.js color keys match color_generator.rb output,
and filter-panel.html remains pure JavaScript.

These tests MUST PASS on unfixed code (confirms baseline behavior to preserve).
"""

import glob
import json
import os
import re
from html.parser import HTMLParser

from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SITE_DIR = os.path.join(os.path.dirname(__file__), '..', '_site')
ASSETS_JS_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'js')
SCSS_PATH = os.path.join(
    os.path.dirname(__file__), '..', '_sass', 'settings', '_paddelbuch_colours.scss'
)
FILTER_PANEL_PATH = os.path.join(
    os.path.dirname(__file__), '..', '_includes', 'filter-panel.html'
)


# Detail page directories in _site that use the four detail layouts
DETAIL_PAGE_DIRS = {
    'spot': 'einstiegsorte',
    'waterway': 'gewaesser',
    'obstacle': 'hindernisse',
    'notice': 'gewaesserereignisse',
}

# Required keys in #map-config JSON for all detail pages
MAP_CONFIG_REQUIRED_KEYS = {'center', 'zoom', 'mapboxUrl', 'locale'}

# Color keys that layer-styles.js references from window.PaddelbuchColors
LAYER_STYLES_COLOR_KEYS = {'secondaryBlue', 'warningYellow', 'dangerRed', 'routesPurple'}

# Expected script loading order within detail-map-layers.html output.
# These external scripts must appear in this relative order (dependencies before dependents).
# Note: layer-control.html and filter-panel.html are includes that expand inline,
# so we track the external scripts they load plus the surrounding scripts.
DETAIL_MAP_LAYERS_SCRIPT_ORDER = [
    'marker-registry.js',
    'filter-engine.js',
    # layer-control.html includes these external scripts:
    'locale-filter.js',
    'html-utils.js',
    'spot-popup.js',
    'obstacle-popup.js',
    'event-notice-popup.js',
    # After layer-control.html and filter-panel.html:
    'marker-styles.js',
    'layer-styles.js',
    'spatial-utils.js',
    'data-loader.js',
    'zoom-layer-manager.js',
]


class MapConfigExtractor(HTMLParser):
    """Extract #map-config JSON content from HTML."""

    def __init__(self):
        super().__init__()
        self._in_map_config = False
        self._content = ''
        self.map_config_json = None

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            attr_dict = dict(attrs)
            if (attr_dict.get('type') == 'application/json'
                    and attr_dict.get('id') == 'map-config'):
                self._in_map_config = True
                self._content = ''

    def handle_data(self, data):
        if self._in_map_config:
            self._content += data

    def handle_endtag(self, tag):
        if tag == 'script' and self._in_map_config:
            self._in_map_config = False
            self.map_config_json = self._content.strip()


class ScriptSrcExtractor(HTMLParser):
    """Extract all <script src="..."> paths from HTML in order."""

    def __init__(self):
        super().__init__()
        self.script_srcs = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            attr_dict = dict(attrs)
            src = attr_dict.get('src')
            if src:
                self.script_srcs.append(src)


def _collect_detail_pages():
    """Collect (layout_type, page_path) pairs for all detail pages in _site."""
    pages = []
    for layout_type, dirname in DETAIL_PAGE_DIRS.items():
        dir_path = os.path.join(SITE_DIR, dirname)
        if not os.path.isdir(dir_path):
            continue
        pattern = os.path.join(dir_path, '**', '*.html')
        for path in glob.glob(pattern, recursive=True):
            rel = os.path.relpath(path, SITE_DIR)
            pages.append((layout_type, rel))
    return pages


_DETAIL_PAGES = _collect_detail_pages()


def _to_camel_case(name):
    """Replicate color_generator.rb's to_camel_case: split on - or _, camelCase."""
    parts = re.split(r'[-_]', name)
    return parts[0] + ''.join(p.capitalize() for p in parts[1:])


def _parse_scss_color_keys():
    """Parse SCSS file and return the set of camelCase color key names."""
    keys = set()
    if not os.path.isfile(SCSS_PATH):
        return keys
    color_regex = re.compile(r'^\$([a-z0-9_-]+):\s*(#[0-9a-fA-F]{3,8})')
    with open(SCSS_PATH, 'r') as f:
        for line in f:
            m = color_regex.match(line.strip())
            if m:
                name = m.group(1)
                hex_val = m.group(2)
                # Only keep standard 3 or 6 digit hex (skip 4/8 digit alpha)
                if len(hex_val) in (4, 7):
                    keys.add(_to_camel_case(name))
    return keys


def _extract_color_keys_from_layer_styles():
    """Parse layer-styles.js and extract color keys referenced via colors.<key>."""
    path = os.path.join(ASSETS_JS_DIR, 'layer-styles.js')
    keys = set()
    if not os.path.isfile(path):
        return keys
    with open(path, 'r') as f:
        content = f.read()
    # Match patterns like colors.secondaryBlue, colors.warningYellow, etc.
    for m in re.finditer(r'colors\.([a-zA-Z]+)', content):
        keys.add(m.group(1))
    return keys


# ---------------------------------------------------------------------------
# Property-based test: #map-config JSON exists with required keys
# ---------------------------------------------------------------------------

@given(test_case=st.sampled_from(_DETAIL_PAGES))
@settings(
    max_examples=min(len(_DETAIL_PAGES), 50),
    suppress_health_check=[HealthCheck.too_slow],
    deadline=None,
)
def test_detail_pages_have_map_config_with_required_keys(test_case):
    """
    **Validates: Requirements 3.1, 3.2**

    Property: For every detail page (spot, waterway, obstacle, notice) in _site,
    a <script type="application/json" id="map-config"> element exists and its
    JSON content contains the required keys: center, zoom, mapboxUrl, locale.
    """
    layout_type, page_rel = test_case
    page_path = os.path.join(SITE_DIR, page_rel)

    with open(page_path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    parser = MapConfigExtractor()
    parser.feed(html)

    assert parser.map_config_json is not None, (
        f"Detail page '{page_rel}' ({layout_type} layout) is missing "
        f"<script type=\"application/json\" id=\"map-config\"> element"
    )

    config = json.loads(parser.map_config_json)
    missing = MAP_CONFIG_REQUIRED_KEYS - set(config.keys())
    assert not missing, (
        f"Detail page '{page_rel}' ({layout_type} layout) #map-config JSON "
        f"is missing required keys: {missing}"
    )

    # Verify center has lat/lon sub-keys
    assert 'lat' in config['center'] and 'lon' in config['center'], (
        f"Detail page '{page_rel}' #map-config 'center' must have 'lat' and 'lon'"
    )


# ---------------------------------------------------------------------------
# Property-based test: Script loading order preserved in detail pages
# ---------------------------------------------------------------------------

@given(test_case=st.sampled_from(_DETAIL_PAGES))
@settings(
    max_examples=min(len(_DETAIL_PAGES), 50),
    suppress_health_check=[HealthCheck.too_slow],
    deadline=None,
)
def test_detail_pages_script_loading_order_preserved(test_case):
    """
    **Validates: Requirements 3.1, 3.3, 3.4, 3.5**

    Property: For every detail page, the external script loading order from
    detail-map-layers.html is preserved — dependencies load before dependents.
    Specifically, the relative order of key scripts must be maintained:
    marker-registry.js before filter-engine.js before layer-control scripts
    before marker-styles.js/layer-styles.js before data-loader.js etc.
    """
    layout_type, page_rel = test_case
    page_path = os.path.join(SITE_DIR, page_rel)

    with open(page_path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    parser = ScriptSrcExtractor()
    parser.feed(html)

    # Extract just the filename from each src path
    script_filenames = []
    for src in parser.script_srcs:
        basename = src.rstrip('/').split('/')[-1]
        script_filenames.append(basename)

    # Verify the expected order is maintained (each script appears after its predecessor)
    last_index = -1
    for expected_script in DETAIL_MAP_LAYERS_SCRIPT_ORDER:
        # Find the first occurrence at or after last_index
        found = False
        for i in range(last_index + 1, len(script_filenames)):
            if script_filenames[i] == expected_script:
                last_index = i
                found = True
                break
        assert found, (
            f"Detail page '{page_rel}' ({layout_type} layout): "
            f"expected script '{expected_script}' not found in correct order. "
            f"Scripts on page: {script_filenames}"
        )


# ---------------------------------------------------------------------------
# Property-based test: paddelbuch-map.js exports PaddelbuchMap.init
# ---------------------------------------------------------------------------

def test_paddelbuch_map_exports_init_and_reads_config():
    """
    **Validates: Requirements 3.1, 3.6**

    Property: paddelbuch-map.js defines PaddelbuchMap.init that reads from
    #map-config and handles the existing config fields (center, zoom, maxZoom,
    mapboxUrl, locale).
    """
    map_js_path = os.path.join(ASSETS_JS_DIR, 'paddelbuch-map.js')
    assert os.path.isfile(map_js_path), "paddelbuch-map.js not found"

    with open(map_js_path, 'r') as f:
        content = f.read()

    # Verify it exports PaddelbuchMap with init
    assert 'global.PaddelbuchMap' in content or 'PaddelbuchMap' in content, (
        "paddelbuch-map.js must export PaddelbuchMap"
    )
    assert 'function init(' in content or 'init:' in content, (
        "paddelbuch-map.js must define an init function"
    )

    # Verify it reads from #map-config
    assert 'map-config' in content, (
        "paddelbuch-map.js must read from #map-config element"
    )

    # Verify it handles the required config fields
    for field in ['center', 'zoom', 'mapboxUrl', 'maxZoom', 'locale']:
        assert f'config.{field}' in content or f"config['{field}']" in content, (
            f"paddelbuch-map.js must handle config field '{field}'"
        )


# ---------------------------------------------------------------------------
# Deterministic test: layer-styles.js color keys match color_generator.rb
# ---------------------------------------------------------------------------

def test_layer_styles_color_keys_match_color_generator():
    """
    **Validates: Requirements 3.7**

    Property: The color keys referenced by layer-styles.js (via colors.<key>)
    are a subset of the keys produced by color_generator.rb from the SCSS file.
    This ensures the color pipeline remains intact after the fix.
    """
    scss_keys = _parse_scss_color_keys()
    assert len(scss_keys) > 0, (
        f"No color keys found in SCSS file {SCSS_PATH}"
    )

    layer_style_keys = _extract_color_keys_from_layer_styles()
    assert len(layer_style_keys) > 0, (
        "No color key references found in layer-styles.js"
    )

    # Verify the specific keys we observed
    for key in LAYER_STYLES_COLOR_KEYS:
        assert key in layer_style_keys, (
            f"layer-styles.js must reference color key '{key}'"
        )
        assert key in scss_keys, (
            f"Color key '{key}' used by layer-styles.js not found in SCSS "
            f"(available: {scss_keys})"
        )

    # All keys used by layer-styles.js must exist in the SCSS-generated set
    missing = layer_style_keys - scss_keys
    assert not missing, (
        f"layer-styles.js references color keys not produced by "
        f"color_generator.rb: {missing}"
    )


# ---------------------------------------------------------------------------
# Deterministic test: filter-panel.html is pure JavaScript (no Jekyll vars)
# ---------------------------------------------------------------------------

def test_filter_panel_has_no_jekyll_variables():
    """
    **Validates: Requirements 3.3**

    Property: filter-panel.html contains no Jekyll/Liquid template variables
    ({{ }} or {% %}), confirming it is pure JavaScript that can be extracted
    to an external file without any data-passing mechanism.
    """
    assert os.path.isfile(FILTER_PANEL_PATH), (
        f"filter-panel.html not found at {FILTER_PANEL_PATH}"
    )

    with open(FILTER_PANEL_PATH, 'r') as f:
        content = f.read()

    liquid_output = re.findall(r'\{\{.*?\}\}', content)
    liquid_tags = re.findall(r'\{%.*?%\}', content)

    assert len(liquid_output) == 0, (
        f"filter-panel.html contains Liquid output tags: {liquid_output}"
    )
    assert len(liquid_tags) == 0, (
        f"filter-panel.html contains Liquid template tags: {liquid_tags}"
    )


# ---------------------------------------------------------------------------
# Deterministic test: paddelbuch-map.js is loaded on all detail pages
# ---------------------------------------------------------------------------

@given(test_case=st.sampled_from(_DETAIL_PAGES))
@settings(
    max_examples=min(len(_DETAIL_PAGES), 50),
    suppress_health_check=[HealthCheck.too_slow],
    deadline=None,
)
def test_detail_pages_load_paddelbuch_map_js(test_case):
    """
    **Validates: Requirements 3.1**

    Property: Every detail page loads paddelbuch-map.js as an external script.
    """
    layout_type, page_rel = test_case
    page_path = os.path.join(SITE_DIR, page_rel)

    with open(page_path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    parser = ScriptSrcExtractor()
    parser.feed(html)

    script_basenames = [s.rstrip('/').split('/')[-1] for s in parser.script_srcs]
    assert 'paddelbuch-map.js' in script_basenames, (
        f"Detail page '{page_rel}' ({layout_type} layout) does not load "
        f"paddelbuch-map.js"
    )
