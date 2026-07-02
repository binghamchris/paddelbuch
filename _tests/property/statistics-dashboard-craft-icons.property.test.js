/**
 * Property-Based Test: Statistics dashboard craft-type icon resolution
 *
 * Feature: paddlecraft-types-change, Property 12: Statistics dashboard resolves craft-type icons with graceful fallback
 *
 * For any craft-type slug, the statistics dashboard renders
 * /assets/images/icons/foldables-dark.svg for `klappbar-und-aufblasbar`,
 * /assets/images/icons/hardshell-dark.svg for `hardshell`, and for any slug
 * absent from PADDLE_CRAFT_ICONS renders the figure with no icon image and
 * without error (the count value and label are still rendered).
 *
 * This test exercises the actual statistics-dashboard.js module in jsdom
 * (mirroring the existing statistics-chartjs-*.property.test.js approach),
 * driving the real PADDLE_CRAFT_ICONS lookup + renderFigure truthy-icon guard.
 *
 * // Feature: paddlecraft-types-change, Property 12: Statistics dashboard resolves craft-type icons with graceful fallback
 * // Validates: Requirements 8.1, 8.2, 8.3, 8.4
 *
 * @jest-environment jsdom
 */

var fc = require('fast-check');
var path = require('path');

// Slugs that resolve to an icon in the module's PADDLE_CRAFT_ICONS map.
var MAPPED_ICONS = {
  'klappbar-und-aufblasbar': '/assets/images/icons/foldables-dark.svg',
  'hardshell': '/assets/images/icons/hardshell-dark.svg'
};

// All slugs known to the module's PADDLE_CRAFT_ICONS map (mapped + legacy).
// Unmapped-slug generation must avoid every one of these.
var ALL_MAPPED_SLUGS = [
  'klappbar-und-aufblasbar',
  'hardshell',
  'seekajak',
  'kanadier',
  'stand-up-paddle-board'
];

// --- Arbitraries ---

// A slug that IS present in the new-type icon map.
var mappedSlugArb = fc.constantFrom('klappbar-und-aufblasbar', 'hardshell');

// A random slug that is NOT present in PADDLE_CRAFT_ICONS at all.
var unmappedSlugArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,20}$/)
  .filter(function (s) {
    return ALL_MAPPED_SLUGS.indexOf(s) === -1;
  });

// A single paddle-craft-type figure entry, mapped or unmapped.
function craftFigureArb() {
  return fc.record({
    slug: fc.oneof(mappedSlugArb, unmappedSlugArb),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    count: fc.nat({ max: 10000 })
  });
}

// A non-empty list of craft-type figures (any mix of mapped/unmapped slugs).
var craftTypesArb = fc.array(craftFigureArb(), { minLength: 1, maxLength: 6 });

describe('Statistics dashboard craft-type icon resolution (Property 12)', function () {
  var modulePath = path.resolve(__dirname, '../../assets/js/statistics-dashboard.js');

  beforeEach(function () {
    document.body.innerHTML =
      '<div id="dashboard-content"></div>' +
      '<div id="dashboard-title"></div>' +
      '<div id="dashboard-description"></div>' +
      '<div id="dashboard-legend"></div>';

    // Mock window.Chart so bar-chart sections instantiate without a real Chart.js
    var chartInstances = [];
    window._chartInstances = chartInstances;
    window.Chart = function MockChart(canvas, config) {
      var instance = {
        canvas: canvas,
        config: config,
        destroyed: false,
        destroy: function () { this.destroyed = true; }
      };
      chartInstances.push(instance);
      return instance;
    };

    window.PaddelbuchColors = {};
    window.PaddelbuchDashboardData = { statisticsMetrics: {} };

    delete window.PaddelbuchStatisticsDashboard;
    delete window.PaddelbuchDashboardRegistry;
    delete require.cache[modulePath];
  });

  afterEach(function () {
    delete window.Chart;
    delete window.PaddelbuchColors;
    delete window.PaddelbuchDashboardData;
    delete window.PaddelbuchStatisticsDashboard;
    delete window.PaddelbuchDashboardRegistry;
    delete window._chartInstances;
    document.body.innerHTML = '';
  });

  it('resolves mapped craft icons and falls back gracefully for unmapped slugs', function () {
    require(modulePath);

    var dashboard = window.PaddelbuchStatisticsDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(craftTypesArb, function (paddleCraftTypes) {
        window.PaddelbuchDashboardData.statisticsMetrics = {
          paddleCraftTypes: paddleCraftTypes
        };
        window._chartInstances.length = 0;

        var contentEl = document.getElementById('dashboard-content');

        // Rendering the paddle-craft-type figures must never throw, even when
        // some slugs are absent from PADDLE_CRAFT_ICONS (Requirement 8.4).
        dashboard.activate({ contentEl: contentEl });

        // Grid 0 is the paddle-craft-type figures section (order preserved).
        var grids = contentEl.querySelectorAll('.statistics-figures-grid');
        if (grids.length < 1) {
          throw new Error('Expected at least one .statistics-figures-grid');
        }
        var craftGrid = grids[0];
        var figures = craftGrid.querySelectorAll('.statistics-figure');

        if (figures.length !== paddleCraftTypes.length) {
          throw new Error(
            'Expected ' + paddleCraftTypes.length +
            ' craft-type figures but found ' + figures.length
          );
        }

        for (var i = 0; i < paddleCraftTypes.length; i++) {
          var item = paddleCraftTypes[i];
          var figure = figures[i];
          var img = figure.querySelector('img.statistics-figure-icon');
          var valueEl = figure.querySelector('.statistics-figure-value');
          var labelEl = figure.querySelector('.statistics-figure-label');

          // Count value and label are ALWAYS rendered (Requirements 8.3, 8.4).
          if (!valueEl) {
            throw new Error('Figure ' + i + ' (' + item.slug + ') is missing its count value');
          }
          if (valueEl.textContent !== String(item.count)) {
            throw new Error(
              'Figure ' + i + ' (' + item.slug + ') count value was "' +
              valueEl.textContent + '" but expected "' + String(item.count) + '"'
            );
          }
          if (!labelEl) {
            throw new Error('Figure ' + i + ' (' + item.slug + ') is missing its label');
          }

          if (Object.prototype.hasOwnProperty.call(MAPPED_ICONS, item.slug)) {
            // Mapped slug -> an <img> with the expected icon src (Reqs 8.1, 8.2).
            if (!img) {
              throw new Error(
                'Mapped slug "' + item.slug + '" rendered no icon <img> element'
              );
            }
            var src = img.getAttribute('src');
            if (src !== MAPPED_ICONS[item.slug]) {
              throw new Error(
                'Mapped slug "' + item.slug + '" icon src was "' + src +
                '" but expected "' + MAPPED_ICONS[item.slug] + '"'
              );
            }
          } else {
            // Unmapped slug -> NO icon <img> element (Requirement 8.3).
            if (img) {
              throw new Error(
                'Unmapped slug "' + item.slug + '" unexpectedly rendered an icon <img> with src "' +
                img.getAttribute('src') + '"'
              );
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
