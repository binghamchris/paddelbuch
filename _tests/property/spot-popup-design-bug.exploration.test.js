/**
 * Bug Condition Exploration Test — Spot Popup Design Fix
 *
 * Tests that generateSpotPopupContent() produces HTML matching the
 * original Gatsby popup structure.
 */

// --- Minimal DOM mock for escapeHtml() ---
global.document = {
  createElement: function() {
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

const htmlUtilsModule = require('../../assets/js/html-utils.js');
global.PaddelbuchHtmlUtils = global.PaddelbuchHtmlUtils || htmlUtilsModule.PaddelbuchHtmlUtils || htmlUtilsModule;
const spotPopupModule = require('../../assets/js/spot-popup.js');
const PaddelbuchSpotPopup = global.PaddelbuchSpotPopup || spotPopupModule.PaddelbuchSpotPopup || spotPopupModule;
const generateSpotPopupContent = PaddelbuchSpotPopup.generateSpotPopupContent;

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

  test('header contains translated spot type category label instead of spot name', () => {
    // Gatsby uses .popup-icon-div for the header
    const headerRegex = /<div class="popup-icon-div">[\s\S]*?<\/div>/;

    const headerDe = htmlDe.match(headerRegex);
    expect(headerDe).not.toBeNull();
    expect(headerDe[0]).toContain('Ein- und Ausstieg');
    expect(headerDe[0]).not.toContain('Thunersee Einstieg Nord');

    const headerEn = htmlEn.match(headerRegex);
    expect(headerEn).not.toBeNull();
    expect(headerEn[0]).toContain('Entry and Exit');
    expect(headerEn[0]).not.toContain('Thunersee Einstieg Nord');
  });

  test('spot name appears as a prominent heading in popup-title', () => {
    // Gatsby uses span.popup-title > h1
    expect(htmlDe).toMatch(/<span class="popup-title"><h1>.*Thunersee Einstieg Nord.*<\/h1><\/span>/);
    expect(htmlEn).toMatch(/<span class="popup-title"><h1>.*Thunersee Einstieg Nord.*<\/h1><\/span>/);
  });

  test('craft types, GPS, and address are not rendered in spot popup', () => {
    // These were removed from spot popups
    expect(htmlDe).not.toContain('Potenziell nutzbar');
    expect(htmlDe).not.toContain('>GPS:<');
    expect(htmlDe).not.toContain('Ungef');
    expect(htmlDe).not.toContain('popup-details-table');
    expect(htmlDe).not.toContain('clipboard-cell-popup');
  });

  test('navigate button text is "Navigate To" / "Navigieren zu"', () => {
    expect(htmlDe).toContain('Navigieren zu');
    expect(htmlEn).toContain('Navigate To');
  });
});
