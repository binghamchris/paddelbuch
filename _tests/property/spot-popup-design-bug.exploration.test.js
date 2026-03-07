/**
 * Bug Condition Exploration Test — Spot Popup Design Fix
 *
 * **Property 1: Bug Condition** — Spot Popup Layout Differs From Original Design
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 *
 * This test calls the ACTUAL generateSpotPopupContent() from spot-popup.js
 * with a representative spot object and asserts the EXPECTED (fixed) behavior.
 *
 * EXPECTED OUTCOME: Test FAILS on unfixed code — this confirms the bug exists.
 * DO NOT fix the test or the code when it fails.
 */

// --- Minimal DOM mock for escapeHtml() which uses document.createElement ---
const mockElement = {
  textContent: '',
  get innerHTML() {
    // Simple HTML escaping for test purposes
    return this.textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

global.document = {
  createElement: function() {
    // Return a fresh mock each time
    return {
      textContent: '',
      get innerHTML() {
        return this.textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
    };
  }
};

// Load the actual module — the IIFE attaches PaddelbuchSpotPopup to `this` (exports in Node)
const spotPopupModule = require('../../assets/js/spot-popup.js');

// The IIFE exports to `this` which in Node require context is `module.exports`
// But since it uses (typeof window !== 'undefined' ? window : this), and window is undefined,
// it attaches to `this`. In Node's require wrapper, `this` = `exports`.
// However, the module doesn't use module.exports explicitly, so we check both paths.
const PaddelbuchSpotPopup = global.PaddelbuchSpotPopup || spotPopupModule.PaddelbuchSpotPopup || spotPopupModule;
const generateSpotPopupContent = PaddelbuchSpotPopup.generateSpotPopupContent;

// Representative spot object with all fields populated
const REPRESENTATIVE_SPOT = {
  name: 'Thunersee Einstieg Nord',
  slug: 'thunersee-einstieg-nord',
  description: '<p>A beautiful entry point on the north shore of Lake Thun with easy water access.</p>',
  spotType_slug: 'einstieg-ausstieg',
  rejected: false,
  location: { lat: 46.756, lon: 7.622 },
  approximateAddress: 'Seestrasse 42, 3600 Thun',
  paddleCraftTypes: ['seekajak', 'kanadier', 'stand-up-paddle-board']
};

describe('Bug Condition Exploration — Spot Popup Design (Property 1)', () => {

  let htmlDe;
  let htmlEn;

  beforeAll(() => {
    htmlDe = generateSpotPopupContent(REPRESENTATIVE_SPOT, 'de');
    htmlEn = generateSpotPopupContent(REPRESENTATIVE_SPOT, 'en');
  });

  /**
   * Requirement 1.1 — Header shows spot type category label, not spot name
   * **Validates: Requirements 1.1**
   *
   * Expected: Header contains "Ein- und Ausstieg" (de) / "Entry and Exit" (en)
   * Bug: Header contains the spot name "Thunersee Einstieg Nord"
   */
  test('header contains translated spot type category label instead of spot name', () => {
    // The header div should contain the category label, NOT the spot name
    const headerRegex = /<div class="spot-popup-header">[\s\S]*?<\/div>/;

    const headerDe = htmlDe.match(headerRegex);
    expect(headerDe).not.toBeNull();
    expect(headerDe[0]).toContain('Ein- und Ausstieg');
    expect(headerDe[0]).not.toContain('Thunersee Einstieg Nord');

    const headerEn = htmlEn.match(headerRegex);
    expect(headerEn).not.toBeNull();
    expect(headerEn[0]).toContain('Entry and Exit');
    expect(headerEn[0]).not.toContain('Thunersee Einstieg Nord');
  });

  /**
   * Requirement 1.5 (partial) — Spot name appears as prominent heading below divider
   * **Validates: Requirements 1.5**
   *
   * Expected: Spot name in an <h3> or similar heading element after an <hr> divider
   * Bug: Spot name is in the header row as <strong>
   */
  test('spot name appears as a prominent heading below a divider', () => {
    // There should be an <hr> divider after the header
    expect(htmlDe).toMatch(/<hr/);

    // Spot name should appear in a heading element (h3) after the divider
    const afterDivider = htmlDe.split(/<hr[^>]*>/)[1];
    expect(afterDivider).toBeDefined();
    expect(afterDivider).toMatch(/<h3[^>]*>.*Thunersee Einstieg Nord.*<\/h3>/);
  });

  /**
   * Requirement 1.2 — Craft types as bullet list with translated names
   * **Validates: Requirements 1.2**
   *
   * Expected: <ul> list with "Seekajak", "Kanadier", "Stand Up Paddle Board (SUP)" (de)
   *           and label "Potenziell nutzbar für" / "Potentially Usable By"
   * Bug: Comma-separated raw slugs with "Typ"/"Type" label
   */
  test('craft types rendered as <ul> bullet list with translated names and correct label', () => {
    // Should NOT contain raw slugs
    expect(htmlDe).not.toMatch(/seekajak/);
    expect(htmlDe).not.toMatch(/kanadier/);
    expect(htmlDe).not.toMatch(/stand-up-paddle-board/);

    // Should contain translated names in a <ul> list
    expect(htmlDe).toMatch(/<ul/);
    expect(htmlDe).toContain('Seekajak');
    expect(htmlDe).toContain('Kanadier');
    expect(htmlDe).toContain('Stand Up Paddle Board (SUP)');

    // Should use "Potenziell nutzbar für" label (de)
    expect(htmlDe).toContain('Potenziell nutzbar f\u00fcr');

    // English locale
    expect(htmlEn).toContain('Potentially Usable By');
    expect(htmlEn).toContain('Sea Kayak');
    expect(htmlEn).toContain('Canoe');
    expect(htmlEn).toContain('Stand Up Paddle Board (SUP)');
    expect(htmlEn).toMatch(/<ul/);
  });

  /**
   * Requirement 1.3 — Copy buttons contain text, no SVG
   * **Validates: Requirements 1.3**
   *
   * Expected: Copy buttons show "Kopieren" (de) / "Copy" (en) text, no <svg>
   * Bug: Copy buttons contain only an SVG clipboard icon
   */
  test('copy buttons contain text "Copy"/"Kopieren" with no <svg> element', () => {
    // Extract all copy buttons
    const copyBtnRegex = /<button[^>]*class="[^"]*copy-btn[^"]*"[^>]*>[\s\S]*?<\/button>/g;

    const copyBtnsDe = htmlDe.match(copyBtnRegex);
    expect(copyBtnsDe).not.toBeNull();
    expect(copyBtnsDe.length).toBeGreaterThanOrEqual(1);

    for (const btn of copyBtnsDe) {
      // Should contain text "Kopieren"
      expect(btn).toContain('Kopieren');
      // Should NOT contain an SVG element
      expect(btn).not.toMatch(/<svg/);
    }

    const copyBtnsEn = htmlEn.match(copyBtnRegex);
    expect(copyBtnsEn).not.toBeNull();
    for (const btn of copyBtnsEn) {
      expect(btn).toContain('Copy');
      expect(btn).not.toMatch(/<svg/);
    }
  });

  /**
   * Requirement 1.4 — Navigate button text is "Navigate To" / "Navigieren zu"
   * **Validates: Requirements 1.4**
   *
   * Expected: "Navigieren zu" (de) / "Navigate To" (en)
   * Bug: "Navigieren" (de) / "Navigate" (en)
   */
  test('navigate button text is "Navigate To" / "Navigieren zu"', () => {
    const navBtnRegex = /<a[^>]*class="[^"]*navigate-btn[^"]*"[^>]*>[\s\S]*?<\/a>/;

    const navBtnDe = htmlDe.match(navBtnRegex);
    expect(navBtnDe).not.toBeNull();
    expect(navBtnDe[0]).toContain('Navigieren zu');

    const navBtnEn = htmlEn.match(navBtnRegex);
    expect(navBtnEn).not.toBeNull();
    expect(navBtnEn[0]).toContain('Navigate To');
  });

  /**
   * Requirement 1.5 — Layout order matches original Gatsby design
   * **Validates: Requirements 1.5**
   *
   * Expected order: category header → divider → title → description → craft types → GPS → address → action buttons
   * Bug order: header (with name) → description → GPS → address → craft types → actions
   */
  test('layout order: category header → divider → title → description → craft types → GPS → address → actions', () => {
    // Find positions of key sections in the HTML
    const headerPos = htmlDe.indexOf('spot-popup-header');
    const dividerPos = htmlDe.indexOf('<hr');
    const titlePos = htmlDe.indexOf('<h3');
    const descriptionPos = htmlDe.indexOf('spot-popup-description');
    const craftTypesPos = htmlDe.indexOf('spot-popup-craft-types') !== -1
      ? htmlDe.indexOf('spot-popup-craft-types')
      : htmlDe.indexOf('spot-popup-craft');
    const gpsPos = htmlDe.indexOf('spot-popup-gps');
    const addressPos = htmlDe.indexOf('spot-popup-address');
    const actionsPos = htmlDe.indexOf('spot-popup-actions');

    // All sections should be present
    expect(headerPos).toBeGreaterThanOrEqual(0);
    expect(dividerPos).toBeGreaterThanOrEqual(0);
    expect(titlePos).toBeGreaterThanOrEqual(0);
    expect(descriptionPos).toBeGreaterThanOrEqual(0);
    expect(craftTypesPos).toBeGreaterThanOrEqual(0);
    expect(gpsPos).toBeGreaterThanOrEqual(0);
    expect(addressPos).toBeGreaterThanOrEqual(0);
    expect(actionsPos).toBeGreaterThanOrEqual(0);

    // Verify order: header < divider < title < description < craftTypes < gps < address < actions
    expect(headerPos).toBeLessThan(dividerPos);
    expect(dividerPos).toBeLessThan(titlePos);
    expect(titlePos).toBeLessThan(descriptionPos);
    expect(descriptionPos).toBeLessThan(craftTypesPos);
    expect(craftTypesPos).toBeLessThan(gpsPos);
    expect(gpsPos).toBeLessThan(addressPos);
    expect(addressPos).toBeLessThan(actionsPos);
  });
});
