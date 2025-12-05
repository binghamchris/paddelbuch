/**
 * Property-Based Tests for Event Notice Detail Page Content
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 16: Event Notice Detail Page Contains Required Information**
 * **Validates: Requirements 7.4**
 * 
 * Property: For any event notice, the detail page shall display the full description,
 * start date, end date, and last updated timestamp.
 */

const fc = require('fast-check');

/**
 * Localized strings for detail page content
 */
const strings = {
  de: {
    approxStartDate: 'Ungefähres Startdatum',
    approxEndDate: 'Ungefähres Enddatum',
    waterway: 'Gewässer',
    lastUpdated: 'Zuletzt aktualisiert',
    summary: 'Kurzfassung'
  },
  en: {
    approxStartDate: 'Approx. Start Date',
    approxEndDate: 'Approx. End Date',
    waterway: 'Waterway',
    lastUpdated: 'Last Updated',
    summary: 'Summary'
  }
};

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
 * Generates the detail page content object for an event notice.
 * This simulates what the notice-detail-content.html include would render.
 * 
 * Property 16: Event Notice Detail Page Contains Required Information
 * 
 * @param {Object} notice - The event notice data object
 * @param {string} locale - The current locale ('de' or 'en')
 * @returns {Object} Object containing the detail page content fields
 */
function generateEventNoticeDetailContent(notice, locale) {
  const localeStrings = strings[locale] || strings.de;
  
  const content = {
    hasFullDescription: false,
    hasStartDate: false,
    hasEndDate: false,
    hasLastUpdated: false,
    hasWaterways: false,
    fullDescription: null,
    startDate: null,
    startDateFormatted: null,
    endDate: null,
    endDateFormatted: null,
    lastUpdated: null,
    lastUpdatedFormatted: null,
    waterways: []
  };

  // Full description (Requirement 7.4)
  if (notice.description && notice.description.trim().length > 0) {
    content.hasFullDescription = true;
    content.fullDescription = notice.description;
  }

  // Start date (Requirement 7.4)
  if (notice.startDate) {
    const formatted = formatDate(notice.startDate, locale);
    if (formatted) {
      content.hasStartDate = true;
      content.startDate = notice.startDate;
      content.startDateFormatted = formatted;
    }
  }

  // End date (Requirement 7.4)
  if (notice.endDate) {
    const formatted = formatDate(notice.endDate, locale);
    if (formatted) {
      content.hasEndDate = true;
      content.endDate = notice.endDate;
      content.endDateFormatted = formatted;
    }
  }

  // Last updated timestamp (Requirement 7.4)
  if (notice.updatedAt) {
    // For updatedAt, we need to handle ISO datetime strings
    let formatted;
    if (typeof notice.updatedAt === 'string') {
      // Extract date part from ISO datetime
      const datePart = notice.updatedAt.split('T')[0];
      formatted = formatDate(datePart, locale);
    } else {
      formatted = formatDate(notice.updatedAt, locale);
    }
    if (formatted) {
      content.hasLastUpdated = true;
      content.lastUpdated = notice.updatedAt;
      content.lastUpdatedFormatted = formatted;
    }
  }

  // Affected waterways (additional info, not required by 7.4 but useful)
  if (notice.waterways && Array.isArray(notice.waterways) && notice.waterways.length > 0) {
    content.hasWaterways = true;
    content.waterways = notice.waterways;
  }

  return content;
}

/**
 * Validates that an event notice detail page contains all required information
 * 
 * @param {Object} notice - The notice data
 * @param {Object} detailContent - The generated detail content
 * @param {string} locale - The current locale
 * @returns {boolean} True if all required fields are present
 */
function validateDetailContent(notice, detailContent, locale) {
  // Full description must be present if notice has description (Requirement 7.4)
  if (notice.description && notice.description.trim().length > 0) {
    if (!detailContent.hasFullDescription || detailContent.fullDescription !== notice.description) {
      return false;
    }
  }

  // Start date must be present if notice has start date (Requirement 7.4)
  if (notice.startDate) {
    const formatted = formatDate(notice.startDate, locale);
    if (formatted && !detailContent.hasStartDate) {
      return false;
    }
  }

  // End date must be present if notice has end date (Requirement 7.4)
  if (notice.endDate) {
    const formatted = formatDate(notice.endDate, locale);
    if (formatted && !detailContent.hasEndDate) {
      return false;
    }
  }

  // Last updated must be present if notice has updatedAt (Requirement 7.4)
  if (notice.updatedAt) {
    if (!detailContent.hasLastUpdated) {
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

// Generate an ISO date string (YYYY-MM-DD)
const dateStringArb = dateArb.map(d => d.toISOString().split('T')[0]);

// Generate an ISO datetime string
const datetimeStringArb = dateArb.map(d => d.toISOString());

// Generate waterway slugs
const waterwaySlugArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

// Generate a full event notice
const eventNoticeArb = fc.record({
  slug: slugArb,
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  locale: localeArb,
  description: fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 1000 }),
    fc.string({ minLength: 1, maxLength: 500 }).map(s => `<p>${s}</p><p>Additional details here.</p>`)
  ),
  startDate: fc.option(dateStringArb, { nil: undefined }),
  endDate: fc.option(dateStringArb, { nil: undefined }),
  updatedAt: fc.option(datetimeStringArb, { nil: undefined }),
  waterways: fc.array(waterwaySlugArb, { minLength: 0, maxLength: 5 })
});

// Generate an event notice with all required fields
const completeEventNoticeArb = fc.record({
  slug: slugArb,
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  locale: localeArb,
  description: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
  startDate: dateStringArb,
  endDate: dateStringArb,
  updatedAt: datetimeStringArb,
  waterways: fc.array(waterwaySlugArb, { minLength: 1, maxLength: 5 })
});

// Generate a minimal event notice
const minimalEventNoticeArb = fc.record({
  slug: slugArb,
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
});

describe('Event Notice Detail Page Content - Property 16', () => {
  /**
   * Property 16: Event Notice Detail Page Contains Required Information
   * For any event notice, the detail page shall display the full description,
   * start date, end date, and last updated timestamp.
   */

  describe('Full description display', () => {
    test('detail page includes full description when notice has description', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          localeArb,
          (notice, locale) => {
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            
            if (notice.description && notice.description.trim().length > 0) {
              return detailContent.hasFullDescription && 
                     detailContent.fullDescription === notice.description;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('full description is NOT truncated (unlike popup)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 200, maxLength: 2000 }),
          localeArb,
          (longDescription, locale) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              description: longDescription
            };
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            
            // Full description should be preserved completely
            return detailContent.fullDescription === longDescription;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('HTML content in description is preserved', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '), { minLength: 1, maxLength: 100 }),
          localeArb,
          (text, locale) => {
            const htmlDescription = `<p><strong>${text}</strong></p><ul><li>Item 1</li></ul>`;
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              description: htmlDescription
            };
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            
            // HTML should be preserved in full description
            return detailContent.fullDescription === htmlDescription;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Start date display', () => {
    test('detail page includes start date when notice has start date', () => {
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
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            
            return detailContent.hasStartDate === true && 
                   detailContent.startDate === startDate &&
                   detailContent.startDateFormatted !== null;
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
            
            const deContent = generateEventNoticeDetailContent(notice, 'de');
            const enContent = generateEventNoticeDetailContent(notice, 'en');
            
            // German format uses dots, English uses slashes
            if (deContent.hasStartDate && enContent.hasStartDate) {
              return deContent.startDateFormatted.includes('.') && 
                     enContent.startDateFormatted.includes('/');
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('End date display', () => {
    test('detail page includes end date when notice has end date', () => {
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
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            
            return detailContent.hasEndDate === true && 
                   detailContent.endDate === endDate &&
                   detailContent.endDateFormatted !== null;
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
            
            const deContent = generateEventNoticeDetailContent(notice, 'de');
            const enContent = generateEventNoticeDetailContent(notice, 'en');
            
            // German format uses dots, English uses slashes
            if (deContent.hasEndDate && enContent.hasEndDate) {
              return deContent.endDateFormatted.includes('.') && 
                     enContent.endDateFormatted.includes('/');
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Last updated timestamp display', () => {
    test('detail page includes last updated when notice has updatedAt', () => {
      fc.assert(
        fc.property(
          datetimeStringArb,
          localeArb,
          (updatedAt, locale) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              updatedAt: updatedAt
            };
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            
            return detailContent.hasLastUpdated === true && 
                   detailContent.lastUpdated === updatedAt &&
                   detailContent.lastUpdatedFormatted !== null;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('last updated is formatted according to locale', () => {
      fc.assert(
        fc.property(
          datetimeStringArb,
          (updatedAt) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              updatedAt: updatedAt
            };
            
            const deContent = generateEventNoticeDetailContent(notice, 'de');
            const enContent = generateEventNoticeDetailContent(notice, 'en');
            
            // German format uses dots, English uses slashes
            if (deContent.hasLastUpdated && enContent.hasLastUpdated) {
              return deContent.lastUpdatedFormatted.includes('.') && 
                     enContent.lastUpdatedFormatted.includes('/');
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Affected waterways display', () => {
    test('detail page includes waterways when notice has waterways', () => {
      fc.assert(
        fc.property(
          fc.array(waterwaySlugArb, { minLength: 1, maxLength: 5 }),
          localeArb,
          (waterways, locale) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              waterways: waterways
            };
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            
            return detailContent.hasWaterways === true && 
                   detailContent.waterways.length === waterways.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no waterways section when waterways array is empty', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const notice = {
              name: 'Test Notice',
              slug: 'test-notice',
              waterways: []
            };
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            
            return detailContent.hasWaterways === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete detail page validation', () => {
    test('all required fields are present based on notice data', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          localeArb,
          (notice, locale) => {
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            return validateDetailContent(notice, detailContent, locale);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('complete notice has all fields populated', () => {
      fc.assert(
        fc.property(
          completeEventNoticeArb,
          localeArb,
          (notice, locale) => {
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            
            return detailContent.hasFullDescription === true &&
                   detailContent.hasStartDate === true &&
                   detailContent.hasEndDate === true &&
                   detailContent.hasLastUpdated === true &&
                   detailContent.hasWaterways === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Detail content generation is deterministic', () => {
    test('same notice and locale always produces same detail content', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          localeArb,
          (notice, locale) => {
            const content1 = generateEventNoticeDetailContent(notice, locale);
            const content2 = generateEventNoticeDetailContent(notice, locale);
            
            return content1.hasFullDescription === content2.hasFullDescription &&
                   content1.fullDescription === content2.fullDescription &&
                   content1.hasStartDate === content2.hasStartDate &&
                   content1.startDateFormatted === content2.startDateFormatted &&
                   content1.hasEndDate === content2.hasEndDate &&
                   content1.endDateFormatted === content2.endDateFormatted &&
                   content1.hasLastUpdated === content2.hasLastUpdated &&
                   content1.lastUpdatedFormatted === content2.lastUpdatedFormatted &&
                   content1.hasWaterways === content2.hasWaterways;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Locale-specific date formatting', () => {
    test('German locale uses German date format (DD.MM.YYYY)', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        startDate: '2024-06-15',
        endDate: '2024-07-20',
        updatedAt: '2024-05-10T12:00:00.000Z'
      };
      const detailContent = generateEventNoticeDetailContent(notice, 'de');
      
      expect(detailContent.startDateFormatted).toBe('15.06.2024');
      expect(detailContent.endDateFormatted).toBe('20.07.2024');
      expect(detailContent.lastUpdatedFormatted).toBe('10.05.2024');
    });

    test('English locale uses English date format (DD/MM/YYYY)', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        startDate: '2024-06-15',
        endDate: '2024-07-20',
        updatedAt: '2024-05-10T12:00:00.000Z'
      };
      const detailContent = generateEventNoticeDetailContent(notice, 'en');
      
      expect(detailContent.startDateFormatted).toBe('15/06/2024');
      expect(detailContent.endDateFormatted).toBe('20/07/2024');
      expect(detailContent.lastUpdatedFormatted).toBe('10/05/2024');
    });

    test('unknown locale defaults to German format', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        startDate: '2024-06-15'
      };
      const detailContent = generateEventNoticeDetailContent(notice, 'fr');
      
      expect(detailContent.startDateFormatted).toBe('15.06.2024');
    });
  });

  describe('Edge cases', () => {
    test('empty description results in no description section', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        description: ''
      };
      const detailContent = generateEventNoticeDetailContent(notice, 'de');
      expect(detailContent.hasFullDescription).toBe(false);
    });

    test('whitespace-only description results in no description section', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        description: '   '
      };
      const detailContent = generateEventNoticeDetailContent(notice, 'de');
      expect(detailContent.hasFullDescription).toBe(false);
    });

    test('missing start date results in no start date section', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice'
      };
      const detailContent = generateEventNoticeDetailContent(notice, 'de');
      expect(detailContent.hasStartDate).toBe(false);
    });

    test('missing end date results in no end date section', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice'
      };
      const detailContent = generateEventNoticeDetailContent(notice, 'de');
      expect(detailContent.hasEndDate).toBe(false);
    });

    test('missing updatedAt results in no last updated section', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice'
      };
      const detailContent = generateEventNoticeDetailContent(notice, 'de');
      expect(detailContent.hasLastUpdated).toBe(false);
    });

    test('invalid date string results in no date', () => {
      const notice = {
        name: 'Test Notice',
        slug: 'test-notice',
        startDate: 'not-a-date',
        endDate: 'invalid'
      };
      const detailContent = generateEventNoticeDetailContent(notice, 'de');
      expect(detailContent.hasStartDate).toBe(false);
      expect(detailContent.hasEndDate).toBe(false);
    });

    test('minimal notice has no optional fields', () => {
      fc.assert(
        fc.property(
          minimalEventNoticeArb,
          localeArb,
          (notice, locale) => {
            const detailContent = generateEventNoticeDetailContent(notice, locale);
            
            return detailContent.hasFullDescription === false &&
                   detailContent.hasStartDate === false &&
                   detailContent.hasEndDate === false &&
                   detailContent.hasLastUpdated === false &&
                   detailContent.hasWaterways === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
