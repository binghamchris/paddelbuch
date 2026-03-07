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

  test('craft types rendered as <ul> bullet list with translated names and correct label', () => {
    expect(htmlDe).not.toMatch(/seekajak/);
    expect(htmlDe).not.toMatch(/kanadier/);
    expect(htmlDe).not.toMatch(/stand-up-paddle-board/);

    expect(htmlDe).toMatch(/<ul/);
    expect(htmlDe).toContain('Seekajak');
    expect(htmlDe).toContain('Kanadier');
    expect(htmlDe).toContain('Stand Up Paddle Board (SUP)');
    expect(htmlDe).toContain('Potenziell nutzbar f\u00fcr');

    expect(htmlEn).toContain('Potentially Usable By');
    expect(htmlEn).toContain('Sea Kayak');
    expect(htmlEn).toContain('Canoe');
    expect(htmlEn).toContain('Stand Up Paddle Board (SUP)');
    expect(htmlEn).toMatch(/<ul/);
  });

  test('copy buttons contain text "Copy"/"Kopieren" with no <svg> element', () => {
    // Copy buttons live inside clipboard-cell-popup cells
    const clipboardCellRegex = /<td class="clipboard-cell-popup">[\s\S]*?<\/td>/g;

    const cellsDe = htmlDe.match(clipboardCellRegex);
    expect(cellsDe).not.toBeNull();
    expect(cellsDe.length).toBeGreaterThanOrEqual(1);

    for (const cell of cellsDe) {
      expect(cell).toContain('Kopieren');
      expect(cell).not.toMatch(/<svg/);
      expect(cell).toContain('class="popup-btn"');
    }

    const cellsEn = htmlEn.match(clipboardCellRegex);
    expect(cellsEn).not.toBeNull();
    for (const cell of cellsEn) {
      expect(cell).toContain('Copy');
      expect(cell).not.toMatch(/<svg/);
      expect(cell).toContain('class="popup-btn"');
    }
  });

  test('navigate button text is "Navigate To" / "Navigieren zu"', () => {
    // Gatsby uses button.popup-btn > a for navigate
    expect(htmlDe).toContain('Navigieren zu');
    expect(htmlEn).toContain('Navigate To');
  });

  test('layout uses popup-details-table for data sections', () => {
    // Gatsby uses a <table class="popup-details-table"> for craft types, GPS, address
    expect(htmlDe).toContain('popup-details-table');
    expect(htmlDe).toContain('<table');
    expect(htmlDe).toContain('<th>');

    // Verify order within the table: craft types th before GPS th before address th
    const craftPos = htmlDe.indexOf('Potenziell nutzbar');
    const gpsPos = htmlDe.indexOf('>GPS:<');
    const addressPos = htmlDe.indexOf('Ungef');
    expect(craftPos).toBeLessThan(gpsPos);
    expect(gpsPos).toBeLessThan(addressPos);
  });
});
