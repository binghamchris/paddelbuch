/**
 * Property-Based Tests for Event Notice Popup Content
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 15: Event Notice Popup Contains Required Information**
 * **Validates: Requirements 7.3**
 * 
 * Property: For any event notice displayed on the map, the popup shall contain 
 * the notice name, description excerpt, start date, and end date.
 */

const fc = require('fast-check');

/**
 * Localized strings for popup content (mirrors event-notice-popup.js)
 */
const strings = {
  de: {
    startDate: 'Startdatum',
    endDate: 'Enddatum',
    moreDetails: 'Weitere Details'
  },
  en: {
    startDate: 'Start date',
    endDate: 'End date',
    moreDetails: 'More details'
  }
};

/**
 * Escapes HTML special characters to prevent XSS
 * 
 * @param {string} text - The text to escape
 * @returns {string} The escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strips HTML tags from a string
 * 
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Truncates text to a maximum length with ellipsis
 * 
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Formats a date according to the specified locale
 * 
 * @param {string|Date} dateValue - The date to format
 * @param {string} locale - The locale ('de' or 'en')
 * @returns {string} Formatted date string
 */
function formatDate(dateValue, locale) {
  if (!dateValue) return '';
  
  var date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    // Parse ISO date string (YYYY-MM-DD) directly to avoid timezone issues
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      const parts = dateValue.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      
      if (locale === 'en') {
        return String(day).padStart(2, '0') + '/' + String(month).padStart(2, '0') + '/' + year;
      } else {
        return String(day).padStart(2, '0') + '.' + String(month).padStart(2, '0') + '.' + year;
      }
    }
    date = new Date(dateValue);
  }
  
  if (isNaN(date.getTime())) return '';
  
  var day = String(date.getDate()).padStart(2, '0');
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var year = date.getFullYear();
  
  if (locale === 'en') {
    return day + '/' + month + '/' + year;
  } else {
    return day + '.' + month + '.' + year;
  }
}

/**
 * Generates the popup content object for an event notice.
 * This simulates what the event-popup.html include would render.
 * 
 * Property 15: Event Notice Popup Contains Required Information
 * 
 * @param {Object} notice - The event notice data object
 * @param {string} locale - The current locale ('de' or 'en')
 * @returns {Object} Object containing the popup content fields
 */
function generateEventNoticePopupContent(notice, locale) {
  const localeStrings = strings[locale] || strings.de;
  
  const content = {
    hasName: false,
    hasDescription: false,
    hasStartDate: false,
    hasEndDate: false,
    hasDetailsLink: false,
    name: null,
    descriptionExcerpt: null,
    startDate: null,
    endDate: null,
    detailsUrl: null
  };

  // Name is always required (Requirement 7.3)
  if (notice.name && notice.name.trim().length > 0) {
    content.hasName = true;
    content.name = notice.name;
  }

  // Description excerpt - truncated to 150 chars (Requirement 7.3)
  if (notice.description && notice.description.trim().length > 0) {
    content.hasDescription = true;
    const plainText = stripHtml(notice.description);
    content.descriptionExcerpt = truncate(plainText, 150);
  }

  // Start date (Requirement 7.3)
  if (notice.startDate) {
    const formatted = formatDate(notice.startDate, locale);
    if (formatted) {
      content.hasStartDate = true;
      content.startDate = formatted;
    }
  }

  // End date (Requirement 7.3)
  if (notice.endDate) {
    const formatted = formatDate(notice.endDate, locale);
    if (formatted) {
      content.hasEndDate = true;
      content.endDate = formatted;
    }
  }

  // Details link requires slug (Requirement 7.3)
  if (notice.slug && notice.slug.trim().length > 0) {
    content.hasDetailsLink = true;
    content.detailsUrl = `/gewaesserereignisse/${notice.slug}/`;
  }

  return content;
}

/**
 * Validates that an event notice popup contains all required information
 * 
 * @param {Object} notice - The notice data
 * @param {Object} popupContent - The generated popup content
 * @param {string} locale - The current locale
 * @returns {boolean} True if all required fields are present
 */
function validatePopupContent(notice, popupContent, locale) {
  // Name must be present if notice has a name
  if (notice.name && notice.name.trim().length > 0) {
    if (!popupContent.hasName || popupContent.name !== notice.name) {
      return false;
    }
  }

  // Description excerpt must be present if notice has description
  if (notice.description && notice.description.trim().length > 0) {
    if (!popupContent.hasDescription) {
      return false;
    }
    // Excerpt should be truncated version of description
    const plainText = stripHtml(notice.description);
    if (plainText.length > 150) {
      if (!popupContent.descriptionExcerpt.endsWith('...')) {
        return false;
      }
    }
  }

  // Start date must be present if notice has start date
  if (notice.startDate) {
    const formatted = formatDate(notice.startDate, locale);
    if (formatted && !popupContent.hasStartDate) {
      return false;
    }
  }

  // End date must be present if notice has end date
  if (notice.endDate) {
    const formatted = formatDate(notice.endDate, locale);
    if (formatted && !popupContent.hasEndDate) {
      return false;
    }
  }

  // Details link must be present if slug exists
  if (notice.slug && notice.slug.trim().length > 0) {
    if (!popupContent.hasDetailsLink || !popupContent.detailsUrl.includes(notice.slug)) {
      return false;
    }
  }

  return true;
}

// Arbitraries for generating test data
const localeArb = fc.constantFrom('de', 'en');
const slugArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

// Generate dates within a reasonable range
const dateArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31')
});

// Generate an ISO date string
const dateStringArb = dateArb.map(d => d.toISOString().split('T')[0]);

// Generate an event notice
const eventNoticeArb = fc.record({
  slug: slugArb,
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  locale: localeArb,
  description: fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 500 }),
    fc.string({ minLength: 1, maxLength: 200 }).map(s => `<p>${s}</p>`)
  ),
  startDate: fc.option(dateStringArb, { nil: undefined }),
  endDate: fc.option(dateStringArb, { nil: undefined })
});

// Generate an event notice without slug
const eventNoticeWithoutSlugArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  locale: localeArb,
  description: fc.string({ minLength: 0, maxLength: 500 }),
  startDate: fc.option(dateStringArb, { nil: undefined }),
  endDate: fc.option(dateStringArb, { nil: undefined })
});

describe('Event Notice Popup Content - Property 15', () => {
  /**
   * Property 15: Event Notice Popup Contains Required Information
   * For any event notice displayed on the map, the popup shall contain 
   * the notice name, description excerpt, start date, and end date.
   */

  describe('Popup contains notice name', () => {
    test('popup includes name when notice has name', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          localeArb,
          (notice, locale) => {
            const popupContent = generateEventNoticePopupContent(notice, locale);
            
            if (notice.name && notice.name.trim().length > 0) {
              return popupContent.hasName && popupContent.name === notice.name;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup contains description excerpt', () => {
    test('popup includes description excerpt when notice has description', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          localeArb,
          (notice, locale) => {
            const popupContent = generateEventNoticePopupContent(notice, locale);
            
            if (notice.description && notice.description.trim().length > 0) {
              return popupContent.hasDescription && popupContent.descriptionExcerpt !== null;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('description excerpt is truncated to 150 characters with ellipsis', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 200, maxLength: 500 }),
          localeArb,
          (longDescription, locale) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              description: longDescription
            };
            const popupContent = generateEventNoticePopupContent(notice, locale);
            
            if (popupContent.hasDescription) {
              const plainText = stripHtml(longDescription);
              if (plainText.length > 150) {
                return popupContent.descriptionExcerpt.endsWith('...');
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('HTML tags are stripped from description', () => {
      fc.assert(
        fc.property(
          // Use alphanumeric strings to avoid characters that look like HTML
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '), { minLength: 1, maxLength: 100 }),
          localeArb,
          (text, locale) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              description: `<p><strong>${text}</strong></p>`
            };
            const popupContent = generateEventNoticePopupContent(notice, locale);
            
            if (popupContent.hasDescription) {
              // The HTML tags (<p>, <strong>) should be stripped
              // The excerpt should not contain the literal tag strings
              return !popupContent.descriptionExcerpt.includes('<p>') && 
                     !popupContent.descriptionExcerpt.includes('</p>') &&
                     !popupContent.descriptionExcerpt.includes('<strong>') &&
                     !popupContent.descriptionExcerpt.includes('</strong>');
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup contains start date', () => {
    test('popup includes start date when notice has start date', () => {
      fc.assert(
        fc.property(
          dateStringArb,
          localeArb,
          (startDate, locale) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              startDate: startDate
            };
            const popupContent = generateEventNoticePopupContent(notice, locale);
            
            return popupContent.hasStartDate === true && popupContent.startDate !== null;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('start date is formatted according to locale', () => {
      fc.assert(
        fc.property(
          dateStringArb,
          (startDate) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              startDate: startDate
            };
            
            const deContent = generateEventNoticePopupContent(notice, 'de');
            const enContent = generateEventNoticePopupContent(notice, 'en');
            
            // German format uses dots, English uses slashes
            if (deContent.hasStartDate && enContent.hasStartDate) {
              return deContent.startDate.includes('.') && enContent.startDate.includes('/');
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup contains end date', () => {
    test('popup includes end date when notice has end date', () => {
      fc.assert(
        fc.property(
          dateStringArb,
          localeArb,
          (endDate, locale) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              endDate: endDate
            };
            const popupContent = generateEventNoticePopupContent(notice, locale);
            
            return popupContent.hasEndDate === true && popupContent.endDate !== null;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('end date is formatted according to locale', () => {
      fc.assert(
        fc.property(
          dateStringArb,
          (endDate) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              endDate: endDate
            };
            
            const deContent = generateEventNoticePopupContent(notice, 'de');
            const enContent = generateEventNoticePopupContent(notice, 'en');
            
            // German format uses dots, English uses slashes
            if (deContent.hasEndDate && enContent.hasEndDate) {
              return deContent.endDate.includes('.') && enContent.endDate.includes('/');
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup includes details link', () => {
    test('popup includes details link when slug is available', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          localeArb,
          (notice, locale) => {
            const popupContent = generateEventNoticePopupContent(notice, locale);
            
            if (notice.slug && notice.slug.trim().length > 0) {
              return popupContent.hasDetailsLink && 
                     popupContent.detailsUrl.includes(notice.slug);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('details URL follows correct pattern /gewaesserereignisse/{slug}/', () => {
      fc.assert(
        fc.property(
          slugArb,
          localeArb,
          (slug, locale) => {
            const notice = {
              name: 'Test Notice',
              slug: slug
            };
            const popupContent = generateEventNoticePopupContent(notice, locale);
            
            if (popupContent.hasDetailsLink) {
              return popupContent.detailsUrl === `/gewaesserereignisse/${slug}/`;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no details link when slug is missing', () => {
      fc.assert(
        fc.property(
          eventNoticeWithoutSlugArb,
          localeArb,
          (notice, locale) => {
            const popupContent = generateEventNoticePopupContent(notice, locale);
            return popupContent.hasDetailsLink === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Locale-specific content', () => {
    test('German locale uses German date format (DD.MM.YYYY)', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        startDate: '2024-06-15',
        endDate: '2024-07-20'
      };
      const popupContent = generateEventNoticePopupContent(notice, 'de');
      
      expect(popupContent.startDate).toBe('15.06.2024');
      expect(popupContent.endDate).toBe('20.07.2024');
    });

    test('English locale uses English date format (DD/MM/YYYY)', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        startDate: '2024-06-15',
        endDate: '2024-07-20'
      };
      const popupContent = generateEventNoticePopupContent(notice, 'en');
      
      expect(popupContent.startDate).toBe('15/06/2024');
      expect(popupContent.endDate).toBe('20/07/2024');
    });

    test('unknown locale defaults to German', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        startDate: '2024-06-15'
      };
      const popupContent = generateEventNoticePopupContent(notice, 'fr');
      
      expect(popupContent.startDate).toBe('15.06.2024');
    });
  });

  describe('Complete popup validation', () => {
    test('all required fields are present based on notice data', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          localeArb,
          (notice, locale) => {
            const popupContent = generateEventNoticePopupContent(notice, locale);
            return validatePopupContent(notice, popupContent, locale);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup generation is deterministic', () => {
    test('same notice and locale always produces same popup content', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          localeArb,
          (notice, locale) => {
            const content1 = generateEventNoticePopupContent(notice, locale);
            const content2 = generateEventNoticePopupContent(notice, locale);
            
            return content1.hasName === content2.hasName &&
                   content1.name === content2.name &&
                   content1.hasDescription === content2.hasDescription &&
                   content1.descriptionExcerpt === content2.descriptionExcerpt &&
                   content1.hasStartDate === content2.hasStartDate &&
                   content1.startDate === content2.startDate &&
                   content1.hasEndDate === content2.hasEndDate &&
                   content1.endDate === content2.endDate &&
                   content1.hasDetailsLink === content2.hasDetailsLink &&
                   content1.detailsUrl === content2.detailsUrl;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    test('empty description results in no description excerpt', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        description: ''
      };
      const popupContent = generateEventNoticePopupContent(notice, 'de');
      expect(popupContent.hasDescription).toBe(false);
    });

    test('whitespace-only description results in no description excerpt', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        description: '   '
      };
      const popupContent = generateEventNoticePopupContent(notice, 'de');
      expect(popupContent.hasDescription).toBe(false);
    });

    test('missing start date results in no start date', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice'
      };
      const popupContent = generateEventNoticePopupContent(notice, 'de');
      expect(popupContent.hasStartDate).toBe(false);
    });

    test('missing end date results in no end date', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice'
      };
      const popupContent = generateEventNoticePopupContent(notice, 'de');
      expect(popupContent.hasEndDate).toBe(false);
    });

    test('invalid date string results in no date', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        startDate: 'not-a-date',
        endDate: 'invalid'
      };
      const popupContent = generateEventNoticePopupContent(notice, 'de');
      expect(popupContent.hasStartDate).toBe(false);
      expect(popupContent.hasEndDate).toBe(false);
    });
  });
});
