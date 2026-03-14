"""
Bug Condition Exploration Test: Inline Scripts Blocked by CSP

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.7**

Property 1: Bug Condition - Inline Scripts Eliminated

For any page load where the CSP header enforces `script-src 'self'`, the five
include files (color-vars.html, map-init.html, layer-control.html,
filter-panel.html, detail-map-layers.html) SHALL contain zero inline <script>
blocks. Only <script type="application/json"> data elements and
<script src="..."> external file references are CSP-safe.

This test is EXPECTED TO FAIL on unfixed code — failure confirms the bug exists.
"""

import glob
import os
from html.parser import HTMLParser

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SITE_DIR = os.path.join(os.path.dirname(__file__), '..', '_site')


class InlineScriptFinder(HTMLParser):
    """Parse HTML and collect information about every <script> element."""

    def __init__(self):
        super().__init__()
        self.scripts = []
        self._in_script = False
        self._attrs = {}
        self._content = ''

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self._in_script = True
            self._attrs = dict(attrs)
            self._content = ''

    def handle_data(self, data):
        if self._in_script:
            self._content += data

    def handle_endtag(self, tag):
        if tag == 'script' and self._in_script:
            self._in_script = False
            has_src = 'src' in self._attrs
            script_type = self._attrs.get('type', '')
            is_json = script_type == 'application/json'
            is_inline_executable = not has_src and not is_json
            self.scripts.append({
                'has_src': has_src,
                'type': script_type,
                'is_inline_executable': is_inline_executable,
                'content_preview': self._content.strip()[:120],
            })


def find_inline_scripts(html_content):
    """Return list of inline executable script info dicts found in *html_content*."""
    parser = InlineScriptFinder()
    parser.feed(html_content)
    return [s for s in parser.scripts if s['is_inline_executable']]


# ---------------------------------------------------------------------------
# Identify which built pages contain output from each include file.
#
# We use content fingerprints that uniquely identify each include's output
# in the rendered HTML.
# ---------------------------------------------------------------------------

INCLUDE_FINGERPRINTS = {
    'color-vars.html': 'window.PaddelbuchColors',
    'map-init.html': 'window.paddelbuchMap = map',
    'layer-control.html': 'window.paddelbuchAddSpotMarker',
    'filter-panel.html': 'PaddelbuchFilterPanel',
    'detail-map-layers.html': 'initDetailMapData',
}


def _collect_pages_for_include(include_name, fingerprint):
    """Find all built HTML pages that contain the fingerprint string."""
    pages = []
    pattern = os.path.join(SITE_DIR, '**', '*.html')
    for path in glob.glob(pattern, recursive=True):
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            if fingerprint in content:
                rel = os.path.relpath(path, SITE_DIR)
                pages.append(rel)
        except OSError:
            continue
    return pages


def _build_include_page_map():
    """Build a mapping: include_name -> list of _site-relative page paths."""
    mapping = {}
    for inc, fp in INCLUDE_FINGERPRINTS.items():
        mapping[inc] = _collect_pages_for_include(inc, fp)
    return mapping


# Build the map once at import time so Hypothesis can draw from it.
_INCLUDE_PAGE_MAP = _build_include_page_map()

# Flatten to a list of (include_name, page_path) pairs for Hypothesis to sample.
_TEST_CASES = []
for inc_name, pages in _INCLUDE_PAGE_MAP.items():
    for page in pages:
        _TEST_CASES.append((inc_name, page))

# Also keep a smaller "representative" set — one page per include — for a fast
# deterministic sanity check.
_REPRESENTATIVE_CASES = []
for inc_name, pages in _INCLUDE_PAGE_MAP.items():
    if pages:
        _REPRESENTATIVE_CASES.append((inc_name, pages[0]))


# ---------------------------------------------------------------------------
# Property-based test
# ---------------------------------------------------------------------------

@given(test_case=st.sampled_from(_TEST_CASES))
@settings(
    max_examples=min(len(_TEST_CASES), 50),
    suppress_health_check=[HealthCheck.too_slow],
    deadline=None,
)
def test_no_inline_executable_scripts_from_includes(test_case):
    """
    **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.7**

    Property: For every page that includes output from one of the five
    include files, ALL <script> elements must either:
      (a) have a `src` attribute (external script), OR
      (b) have `type="application/json"` (data-only, CSP-safe).

    No inline executable <script> blocks should exist.

    On UNFIXED code this test WILL FAIL because the five includes still
    contain inline scripts that would be blocked by `script-src 'self'`.
    """
    include_name, page_rel = test_case
    page_path = os.path.join(SITE_DIR, page_rel)

    with open(page_path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    inline_scripts = find_inline_scripts(html)

    assert len(inline_scripts) == 0, (
        f"CSP violation: page '{page_rel}' (includes {include_name}) "
        f"contains {len(inline_scripts)} inline executable <script> block(s) "
        f"that would be blocked by script-src 'self'.\n"
        f"Inline scripts found:\n"
        + "\n".join(
            f"  [{i+1}] {s['content_preview']}..."
            for i, s in enumerate(inline_scripts)
        )
    )


# ---------------------------------------------------------------------------
# Deterministic test — one page per include, always runs all five
# ---------------------------------------------------------------------------

def test_each_include_has_no_inline_scripts():
    """
    **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.7**

    Deterministic check: for each of the five include files, pick one
    representative page and assert zero inline executable scripts.
    """
    failures = []

    for inc_name, page_rel in _REPRESENTATIVE_CASES:
        page_path = os.path.join(SITE_DIR, page_rel)
        with open(page_path, 'r', encoding='utf-8', errors='replace') as f:
            html = f.read()

        inline_scripts = find_inline_scripts(html)
        if inline_scripts:
            previews = "; ".join(s['content_preview'][:60] for s in inline_scripts)
            failures.append(
                f"  {inc_name} -> {page_rel}: "
                f"{len(inline_scripts)} inline script(s) [{previews}]"
            )

    assert not failures, (
        f"CSP violation: {len(failures)} include(s) still produce inline "
        f"executable <script> blocks:\n" + "\n".join(failures)
    )
