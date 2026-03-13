/**
 * Regression Tests: Event Notice Date Filtering in layer-control.html
 *
 * Prevents regression of the bug where layer-control.html called
 * PaddelbuchEventNoticePopup.isDateInFuture() — a function that does not exist
 * on that module. The correct module is PaddelbuchDateUtils.
 *
 * The bug caused a JS runtime error that silently killed all event notice
 * marker rendering on the main map.
 *
 * Feature: best-practices-cleanup
 * Validates: Requirement 7.1 (event notice date filtering)
 */

const fs = require('fs');
const path = require('path');

const layerControlPath = path.join(__dirname, '..', '..', '_includes', 'layer-control.html');
const layerControlSource = fs.readFileSync(layerControlPath, 'utf-8');

const eventNoticePopupPath = path.join(__dirname, '..', '..', 'assets', 'js', 'event-notice-popup.js');
const eventNoticePopupSource = fs.readFileSync(eventNoticePopupPath, 'utf-8');

const dateUtilsPath = path.join(__dirname, '..', '..', 'assets', 'js', 'date-utils.js');
const dateUtilsSource = fs.readFileSync(dateUtilsPath, 'utf-8');

describe('Regression: Event notice date filtering uses correct module', () => {
  test('layer-control.html must NOT call PaddelbuchEventNoticePopup.isDateInFuture', () => {
    // This was the bug: isDateInFuture does not exist on PaddelbuchEventNoticePopup
    expect(layerControlSource).not.toMatch(/PaddelbuchEventNoticePopup\.isDateInFuture/);
  });

  test('layer-control.html must call PaddelbuchDateUtils.isDateInFuture for notice filtering', () => {
    // The correct module for date comparison
    expect(layerControlSource).toMatch(/PaddelbuchDateUtils\.isDateInFuture/);
  });

  test('event-notice-popup.js must NOT export isDateInFuture', () => {
    // isDateInFuture lives on PaddelbuchDateUtils, not PaddelbuchEventNoticePopup
    const exportBlock = eventNoticePopupSource.match(
      /global\.PaddelbuchEventNoticePopup\s*=\s*\{([^}]+)\}/s
    );
    expect(exportBlock).not.toBeNull();
    expect(exportBlock[1]).not.toMatch(/\bisDateInFuture\b/);
  });

  test('date-utils.js must export isDateInFuture on PaddelbuchDateUtils', () => {
    const exportBlock = dateUtilsSource.match(
      /global\.PaddelbuchDateUtils\s*=\s*\{([^}]+)\}/s
    );
    expect(exportBlock).not.toBeNull();
    expect(exportBlock[1]).toMatch(/\bisDateInFuture\b/);
  });

  test('layer-control.html includes date-utils.js before event-notice-popup.js', () => {
    const dateUtilsIndex = layerControlSource.indexOf('date-utils.js');
    const eventNoticeIndex = layerControlSource.indexOf('event-notice-popup.js');
    expect(dateUtilsIndex).toBeGreaterThan(-1);
    expect(eventNoticeIndex).toBeGreaterThan(-1);
    expect(dateUtilsIndex).toBeLessThan(eventNoticeIndex);
  });
});
