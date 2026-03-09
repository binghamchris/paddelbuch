#!/bin/bash
# Bug Condition Exploration Test - Locale Link Routing
#
# **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
#
# Property 1: Fault Condition - Internal Links Include Locale Prefix for Non-Default Locale
#
# For any internal link rendered when site.lang != site.default_lang (English locale),
# the generated href SHALL start with /en/, ensuring the user remains on their
# selected language version.
#
# Bug Condition: isBugCondition(input) where
#   input.currentLocale != input.defaultLocale
#   AND input.linkHref does NOT start with "/" + input.currentLocale + "/"
#   AND input.linkHref is an internal link (starts with "/")
#
# This test is EXPECTED TO FAIL on unfixed code - failure confirms the bug exists.

set -euo pipefail

SITE_DIR="_site/en"
LOCALE_PREFIX="/en/"
FAIL_COUNT=0
PASS_COUNT=0
TOTAL_LINKS=0
COUNTEREXAMPLES=""

# German path segments that should be prefixed with /en/ on English pages
GERMAN_PATHS=(
  "/einstiegsorte/"
  "/gewaesser/"
  "/hindernisse/"
  "/gewaesserereignisse/"
  "/offene-daten/"
  "/ueber/"
)

check_links_in_file() {
  local file="$1"
  local context="$2"

  # Extract all href="/..." values (internal links starting with /)
  # Uses grep -oE for macOS compatibility
  local hrefs
  hrefs=$(grep -oE 'href="/[^"]*"' "$file" 2>/dev/null | sed 's/href="//;s/"$//' || true)

  while IFS= read -r href; do
    # Skip empty lines
    [[ -z "$href" ]] && continue

    # Skip asset/static paths
    case "$href" in
      /assets/*|/api/*|*.css|*.js|*.svg|*.png|*.ico) continue ;;
    esac

    # Skip the root path "/" (navbar brand link)
    [[ "$href" == "/" ]] && continue

    # Skip JavaScript template literals (contain single quotes)
    [[ "$href" == *"'"* ]] && continue

    # Skip language switcher links (these correctly point to the other locale version)
    # Language switcher links are inside the lang dropdown and point to the German version
    # of the current page — they should NOT have /en/ prefix (Requirement 3.2)
    local is_lang_switcher=false
    if grep -q "nav-dropdown-lang" "$file" 2>/dev/null; then
      # Check if this exact href appears inside the language switcher section
      local lang_section
      lang_section=$(sed -n '/nav-dropdown-lang/,/<\/ul>/p' "$file" 2>/dev/null || true)
      if echo "$lang_section" | grep -qF "href=\"${href}\"" 2>/dev/null; then
        is_lang_switcher=true
      fi
    fi
    [[ "$is_lang_switcher" == true ]] && continue

    # Check if this is a German path segment that needs locale prefix
    # After the fix, links may start with /en/ followed by the German path
    local is_german_path=false
    for gpath in "${GERMAN_PATHS[@]}"; do
      case "$href" in
        ${gpath}*) is_german_path=true; break ;;
        ${LOCALE_PREFIX}${gpath#/}*) is_german_path=true; break ;;
      esac
    done

    # Also check paths starting with /gewaesser/ without trailing slash (e.g., /gewaesser/seen)
    case "$href" in
      /gewaesser/*) is_german_path=true ;;
      ${LOCALE_PREFIX}gewaesser/*) is_german_path=true ;;
    esac

    # Only check links that match known German path patterns
    if [[ "$is_german_path" == true ]]; then
      TOTAL_LINKS=$((TOTAL_LINKS + 1))

      case "$href" in
        ${LOCALE_PREFIX}*)
          PASS_COUNT=$((PASS_COUNT + 1))
          ;;
        *)
          FAIL_COUNT=$((FAIL_COUNT + 1))
          COUNTEREXAMPLES="${COUNTEREXAMPLES}
  FAIL [${context}]: href=\"${href}\" (expected to start with ${LOCALE_PREFIX})"
          ;;
      esac
    fi
  done <<< "$hrefs"
}

echo "=============================================="
echo "Locale Link Routing - Bug Exploration Test"
echo "Property 1: Internal links on English pages"
echo "must start with /en/ prefix"
echo "=============================================="
echo ""

# --- Test 1: Spot Pages - includes spot-popup + spot-detail-content + header (Req 1.1, 1.2, 1.5) ---
echo "--- Test 1: Spot Pages (Req 1.1, 1.2, 1.5, 1.7) ---"
spot_count=0
while IFS= read -r page; do
  slug=$(echo "$page" | sed "s|${SITE_DIR}/einstiegsorte/||" | sed 's|/index.html||')
  check_links_in_file "$page" "spot-page:${slug}"
  spot_count=$((spot_count + 1))
done < <(find "$SITE_DIR/einstiegsorte" -name "index.html" 2>/dev/null | head -10)
echo "Checked $spot_count spot pages (popup links, waterway links, header nav links)"

# --- Test 2: Waterway list pages (Req 1.5) ---
echo "--- Test 2: Waterway List Pages (Req 1.5) ---"
ww_count=0
if [[ -d "$SITE_DIR/gewaesser" ]]; then
  while IFS= read -r page; do
    slug=$(echo "$page" | sed "s|${SITE_DIR}/gewaesser/||" | sed 's|/index.html||')
    check_links_in_file "$page" "waterway-page:${slug}"
    ww_count=$((ww_count + 1))
  done < <(find "$SITE_DIR/gewaesser" -name "index.html" 2>/dev/null | head -10)
fi
echo "Checked $ww_count waterway pages"

# --- Test 3: Open Data pages (Req 1.7) ---
echo "--- Test 3: Open Data Pages (Req 1.7) ---"
od_count=0
if [[ -d "$SITE_DIR/offene-daten" ]]; then
  while IFS= read -r page; do
    slug=$(echo "$page" | sed "s|${SITE_DIR}/offene-daten/||" | sed 's|/index.html||')
    check_links_in_file "$page" "open-data:${slug}"
    od_count=$((od_count + 1))
  done < <(find "$SITE_DIR/offene-daten" -name "index.html" 2>/dev/null | head -10)
fi
echo "Checked $od_count open data pages"

# --- Test 4: Index page (all link types) ---
echo "--- Test 4: Index Page ---"
if [[ -f "$SITE_DIR/index.html" ]]; then
  check_links_in_file "$SITE_DIR/index.html" "index-page"
  echo "Checked English index page"
fi

echo ""
echo "=============================================="
echo "RESULTS"
echo "=============================================="
echo "Total internal links checked: $TOTAL_LINKS"
echo "Links with correct /en/ prefix: $PASS_COUNT"
echo "Links MISSING /en/ prefix: $FAIL_COUNT"
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "COUNTEREXAMPLES (first 50):"
  echo "$COUNTEREXAMPLES" | head -50
  echo ""
  echo "TEST FAILED: $FAIL_COUNT internal links on English pages are missing the /en/ locale prefix."
  echo "This confirms the bug: links use German paths without locale prefix."
  exit 1
elif [[ $TOTAL_LINKS -eq 0 ]]; then
  echo "WARNING: No internal links found to check. Build may be incomplete."
  exit 2
else
  echo "TEST PASSED: All $TOTAL_LINKS internal links on English pages have the /en/ prefix."
  exit 0
fi
