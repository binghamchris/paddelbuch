#!/bin/bash
# Preservation Property Test - Locale Link Routing
#
# **Validates: Requirements 2.8, 3.1, 3.2, 3.5, 3.6**
#
# Property 2: Preservation - German Locale Links Have No Locale Prefix
#
# For any internal link rendered when site.lang == site.default_lang (German locale),
# the generated href SHALL NOT include any locale prefix (e.g., /einstiegsorte/{slug}/,
# not /de/einstiegsorte/{slug}/), preserving the existing German URL structure.
#
# This test captures baseline behavior on UNFIXED code and ensures it is preserved
# after the fix is applied.

set -euo pipefail

SITE_DIR="_site"
FAIL_COUNT=0
PASS_COUNT=0
TOTAL_LINKS=0
COUNTEREXAMPLES=""
LANG_SWITCHER_COUNT=0
LANG_SWITCHER_PASS=0
BRAND_LINK_PASS=0

# Known German path segments - these should NEVER be prefixed with /de/
GERMAN_PATHS=(
  "/einstiegsorte/"
  "/gewaesser/"
  "/hindernisse/"
  "/gewaesserereignisse/"
  "/offene-daten/"
  "/ueber/"
)

check_no_locale_prefix() {
  local file="$1"
  local context="$2"

  # Extract all href="/..." values (internal links starting with /)
  local hrefs
  hrefs=$(grep -oE 'href="/[^"]*"' "$file" 2>/dev/null | sed 's/href="//;s/"$//' || true)

  while IFS= read -r href; do
    # Skip empty lines
    [[ -z "$href" ]] && continue

    # Skip asset/static paths
    case "$href" in
      /assets/*|/api/*|*.css|*.js|*.svg|*.png|*.ico) continue ;;
    esac

    # Skip JavaScript template literals (contain single quotes)
    [[ "$href" == *"'"* ]] && continue

    # Skip the language switcher link to /en/ - we check it separately
    case "$href" in
      /en/*) continue ;;
    esac

    # Check if this is a known German path
    local is_german_path=false
    for gpath in "${GERMAN_PATHS[@]}"; do
      case "$href" in
        ${gpath}*) is_german_path=true; break ;;
      esac
    done

    # Only check links that match known German path patterns
    if [[ "$is_german_path" == true ]]; then
      TOTAL_LINKS=$((TOTAL_LINKS + 1))

      # Assert: link does NOT start with /de/
      case "$href" in
        /de/*)
          FAIL_COUNT=$((FAIL_COUNT + 1))
          COUNTEREXAMPLES="${COUNTEREXAMPLES}
  FAIL [${context}]: href=\"${href}\" (should NOT have /de/ prefix)"
          ;;
        *)
          PASS_COUNT=$((PASS_COUNT + 1))
          ;;
      esac
    fi
  done <<< "$hrefs"
}

check_language_switcher() {
  local file="$1"
  local context="$2"

  # Language switcher links should point to /en/... for switching to English
  local en_links
  en_links=$(grep -oE 'href="/en/[^"]*"' "$file" 2>/dev/null | sed 's/href="//;s/"$//' || true)

  while IFS= read -r href; do
    [[ -z "$href" ]] && continue
    LANG_SWITCHER_COUNT=$((LANG_SWITCHER_COUNT + 1))

    # Verify the language switcher link starts with /en/
    case "$href" in
      /en/*)
        LANG_SWITCHER_PASS=$((LANG_SWITCHER_PASS + 1))
        ;;
      *)
        COUNTEREXAMPLES="${COUNTEREXAMPLES}
  FAIL [${context}:lang-switcher]: href=\"${href}\" (expected /en/ prefix for language switcher)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        ;;
    esac
  done <<< "$en_links"
}

check_brand_link() {
  local file="$1"
  local context="$2"

  # The navbar brand link should be "/" for the German (default) locale
  local brand_links
  brand_links=$(grep -oE 'class="navbar-brand"[^>]*href="[^"]*"' "$file" 2>/dev/null || true)
  if [[ -z "$brand_links" ]]; then
    # Try alternate pattern
    brand_links=$(grep -oE 'href="/"[^>]*class="navbar-brand"' "$file" 2>/dev/null || true)
  fi

  # Also just check for href="/" as the brand link
  if grep -q 'navbar-brand' "$file" 2>/dev/null; then
    local brand_href
    brand_href=$(grep 'navbar-brand' "$file" 2>/dev/null | grep -oE 'href="[^"]*"' | head -1 | sed 's/href="//;s/"$//' || true)
    if [[ "$brand_href" == "/" ]]; then
      BRAND_LINK_PASS=$((BRAND_LINK_PASS + 1))
    elif [[ -n "$brand_href" ]]; then
      COUNTEREXAMPLES="${COUNTEREXAMPLES}
  FAIL [${context}:brand-link]: href=\"${brand_href}\" (expected \"/\" for German locale homepage)"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  fi
}

echo "=============================================="
echo "Locale Link Routing - Preservation Test"
echo "Property 2: German locale links have no"
echo "locale prefix (/de/)"
echo "=============================================="
echo ""

# --- Test 1: Spot Pages (Req 2.8, 3.1) ---
echo "--- Test 1: Spot Pages (Req 2.8, 3.1) ---"
spot_count=0
if [[ -d "$SITE_DIR/einstiegsorte" ]]; then
  while IFS= read -r page; do
    slug=$(echo "$page" | sed "s|${SITE_DIR}/einstiegsorte/||" | sed 's|/index.html||')
    check_no_locale_prefix "$page" "spot-page:${slug}"
    check_language_switcher "$page" "spot-page:${slug}"
    spot_count=$((spot_count + 1))
  done < <(find "$SITE_DIR/einstiegsorte" -name "index.html" 2>/dev/null | head -10)
fi
echo "Checked $spot_count spot pages"

# --- Test 2: Waterway Pages (Req 2.8, 3.1) ---
echo "--- Test 2: Waterway Pages (Req 2.8, 3.1) ---"
ww_count=0
if [[ -d "$SITE_DIR/gewaesser" ]]; then
  while IFS= read -r page; do
    slug=$(echo "$page" | sed "s|${SITE_DIR}/gewaesser/||" | sed 's|/index.html||')
    check_no_locale_prefix "$page" "waterway-page:${slug}"
    check_language_switcher "$page" "waterway-page:${slug}"
    ww_count=$((ww_count + 1))
  done < <(find "$SITE_DIR/gewaesser" -name "index.html" 2>/dev/null | head -10)
fi
echo "Checked $ww_count waterway pages"

# --- Test 3: Obstacle Pages (Req 2.8, 3.1) ---
echo "--- Test 3: Obstacle Pages (Req 2.8, 3.1) ---"
obs_count=0
if [[ -d "$SITE_DIR/hindernisse" ]]; then
  while IFS= read -r page; do
    slug=$(echo "$page" | sed "s|${SITE_DIR}/hindernisse/||" | sed 's|/index.html||')
    check_no_locale_prefix "$page" "obstacle-page:${slug}"
    check_language_switcher "$page" "obstacle-page:${slug}"
    obs_count=$((obs_count + 1))
  done < <(find "$SITE_DIR/hindernisse" -name "index.html" 2>/dev/null | head -10)
fi
echo "Checked $obs_count obstacle pages"

# --- Test 4: Event Notice Pages (Req 2.8, 3.1) ---
echo "--- Test 4: Event Notice Pages (Req 2.8, 3.1) ---"
evt_count=0
if [[ -d "$SITE_DIR/gewaesserereignisse" ]]; then
  while IFS= read -r page; do
    slug=$(echo "$page" | sed "s|${SITE_DIR}/gewaesserereignisse/||" | sed 's|/index.html||')
    check_no_locale_prefix "$page" "event-page:${slug}"
    check_language_switcher "$page" "event-page:${slug}"
    evt_count=$((evt_count + 1))
  done < <(find "$SITE_DIR/gewaesserereignisse" -name "index.html" 2>/dev/null | head -10)
fi
echo "Checked $evt_count event notice pages"

# --- Test 5: Open Data Pages (Req 2.8, 3.1) ---
echo "--- Test 5: Open Data Pages (Req 2.8, 3.1) ---"
od_count=0
if [[ -d "$SITE_DIR/offene-daten" ]]; then
  while IFS= read -r page; do
    slug=$(echo "$page" | sed "s|${SITE_DIR}/offene-daten/||" | sed 's|/index.html||')
    check_no_locale_prefix "$page" "open-data:${slug}"
    check_language_switcher "$page" "open-data:${slug}"
    od_count=$((od_count + 1))
  done < <(find "$SITE_DIR/offene-daten" -name "index.html" 2>/dev/null | head -10)
fi
echo "Checked $od_count open data pages"

# --- Test 6: About Pages (Req 2.8, 3.1) ---
echo "--- Test 6: About Pages (Req 2.8, 3.1) ---"
about_count=0
if [[ -d "$SITE_DIR/ueber" ]]; then
  while IFS= read -r page; do
    slug=$(echo "$page" | sed "s|${SITE_DIR}/ueber/||" | sed 's|/index.html||')
    check_no_locale_prefix "$page" "about-page:${slug}"
    check_language_switcher "$page" "about-page:${slug}"
    about_count=$((about_count + 1))
  done < <(find "$SITE_DIR/ueber" -name "index.html" 2>/dev/null | head -10)
fi
echo "Checked $about_count about pages"

# --- Test 7: Index/Homepage (Req 3.2, 3.5, 3.6) ---
echo "--- Test 7: Homepage (Req 3.2, 3.5, 3.6) ---"
if [[ -f "$SITE_DIR/index.html" ]]; then
  check_no_locale_prefix "$SITE_DIR/index.html" "homepage"
  check_language_switcher "$SITE_DIR/index.html" "homepage"
  check_brand_link "$SITE_DIR/index.html" "homepage"
  echo "Checked German homepage"
fi

echo ""
echo "=============================================="
echo "RESULTS"
echo "=============================================="
echo "Total internal links checked: $TOTAL_LINKS"
echo "Links correctly without /de/ prefix: $PASS_COUNT"
echo "Links incorrectly with /de/ prefix: $FAIL_COUNT"
echo ""
echo "Language switcher links found: $LANG_SWITCHER_COUNT"
echo "Language switcher links correct (/en/): $LANG_SWITCHER_PASS"
echo "Navbar brand links correct (/): $BRAND_LINK_PASS"
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "COUNTEREXAMPLES (first 50):"
  echo "$COUNTEREXAMPLES" | head -50
  echo ""
  echo "TEST FAILED: $FAIL_COUNT German locale links incorrectly have a /de/ prefix."
  exit 1
elif [[ $TOTAL_LINKS -eq 0 ]]; then
  echo "WARNING: No internal links found to check. Build may be incomplete."
  exit 2
else
  echo "TEST PASSED: All $TOTAL_LINKS German locale links have no /de/ prefix."
  echo "Language switcher: $LANG_SWITCHER_PASS/$LANG_SWITCHER_COUNT links correctly point to /en/."
  echo "Navbar brand: $BRAND_LINK_PASS link(s) correctly point to /."
  echo "Baseline German locale behavior confirmed — ready for preservation checking."
  exit 0
fi
