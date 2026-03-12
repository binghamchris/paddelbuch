/**
 * Unit Tests for Spot Popup Utility Functions
 *
 * Tests the 5 utility functions exported by spot-popup.js:
 * escapeHtml, stripHtml, truncate, getIconPath, getLabels
 *
 * Validates: Requirements 2.12
 *
 * @jest-environment jsdom
 */

require('../../assets/js/spot-popup.js');
const { escapeHtml, stripHtml, truncate, getIconPath, getLabels } = window.PaddelbuchSpotPopup;

describe('escapeHtml', () => {
  test('escapes < and > characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).not.toContain('<script>');
    expect(escapeHtml('<div>')).not.toContain('<div>');
  });

  test('escapes & character', () => {
    expect(escapeHtml('a & b')).toContain('&amp;');
  });

  test('escapes " and \' characters', () => {
    const result = escapeHtml('"hello" & \'world\'');
    expect(result).not.toBe('"hello" & \'world\'');
  });

  test('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('preserves normal text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('stripHtml', () => {
  test('removes HTML tags', () => {
    expect(stripHtml('<p>hello</p>')).toBe('hello');
  });

  test('handles nested tags', () => {
    expect(stripHtml('<div><p>text</p></div>')).toBe('text');
  });

  test('returns empty string for null', () => {
    expect(stripHtml(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(stripHtml(undefined)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  test('preserves text without tags', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });
});

describe('truncate', () => {
  test('truncates text longer than maxLength and appends "..."', () => {
    expect(truncate('hello world this is long', 10)).toBe('hello worl...');
  });

  test('returns original text if shorter than maxLength', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  test('returns original text if equal to maxLength', () => {
    expect(truncate('exact', 5)).toBe('exact');
  });

  test('returns empty string for null', () => {
    expect(truncate(null, 10)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(truncate(undefined, 10)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(truncate('', 10)).toBe('');
  });
});

describe('getIconPath', () => {
  test('returns correct path for einstieg-ausstieg', () => {
    expect(getIconPath('einstieg-ausstieg', false, 'light')).toBe('/assets/images/icons/entryexit-light.svg');
  });

  test('returns correct path for nur-einstieg', () => {
    expect(getIconPath('nur-einstieg', false, 'light')).toBe('/assets/images/icons/entry-light.svg');
  });

  test('returns correct path for nur-ausstieg', () => {
    expect(getIconPath('nur-ausstieg', false, 'light')).toBe('/assets/images/icons/exit-light.svg');
  });

  test('returns correct path for rasthalte', () => {
    expect(getIconPath('rasthalte', false, 'light')).toBe('/assets/images/icons/rest-light.svg');
  });

  test('returns correct path for notauswasserungsstelle', () => {
    expect(getIconPath('notauswasserungsstelle', false, 'light')).toBe('/assets/images/icons/emergency-light.svg');
  });

  test('returns noentry icon when isRejected is true regardless of slug', () => {
    expect(getIconPath('einstieg-ausstieg', true, 'light')).toBe('/assets/images/icons/noentry-light.svg');
    expect(getIconPath('rasthalte', true, 'light')).toBe('/assets/images/icons/noentry-light.svg');
  });

  test('returns default entryexit icon for unknown slug', () => {
    expect(getIconPath('unknown-type', false, 'light')).toBe('/assets/images/icons/entryexit-light.svg');
  });

  test('returns default entryexit icon for null slug', () => {
    expect(getIconPath(null, false, 'light')).toBe('/assets/images/icons/entryexit-light.svg');
  });

  test('respects dark variant parameter', () => {
    expect(getIconPath('einstieg-ausstieg', false, 'dark')).toBe('/assets/images/icons/entryexit-dark.svg');
  });

  test('defaults to light variant when not specified', () => {
    expect(getIconPath('einstieg-ausstieg', false)).toBe('/assets/images/icons/entryexit-light.svg');
  });
});

describe('getLabels', () => {
  const expectedKeys = [
    'gps', 'approxAddress', 'type', 'potentiallyUsableBy',
    'copy', 'copyGps', 'copyAddress', 'navigate', 'moreDetails'
  ];

  test('returns German labels when locale is "de"', () => {
    const labels = getLabels('de');
    expect(labels.approxAddress).toBe('Ungefähre Adresse');
    expect(labels.type).toBe('Typ');
    expect(labels.navigate).toBe('Navigieren zu');
  });

  test('returns English labels when locale is "en"', () => {
    const labels = getLabels('en');
    expect(labels.approxAddress).toBe('Approx. Address');
    expect(labels.type).toBe('Type');
    expect(labels.navigate).toBe('Navigate To');
  });

  test('defaults to German for any other locale value', () => {
    const labels = getLabels('fr');
    expect(labels.approxAddress).toBe('Ungefähre Adresse');
  });

  test('all expected keys are present for German locale', () => {
    const labels = getLabels('de');
    expectedKeys.forEach(key => {
      expect(labels).toHaveProperty(key);
      expect(typeof labels[key]).toBe('string');
    });
  });

  test('all expected keys are present for English locale', () => {
    const labels = getLabels('en');
    expectedKeys.forEach(key => {
      expect(labels).toHaveProperty(key);
      expect(typeof labels[key]).toBe('string');
    });
  });
});
