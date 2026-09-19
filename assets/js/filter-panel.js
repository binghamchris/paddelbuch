(function(global) {
  'use strict';

  var FilterPanelControl = null;
  var controlInstance = null;

  // Breathing room left between a popup and the controls it was moved clear of.
  var POPUP_CONTROL_GAP = 8;

  /**
   * Initialize the filter panel and add it to the map.
   *
   * @param {L.Map} map - Leaflet map instance
   * @param {Array} dimensionConfigs - Array of dimension config objects
   * @param {Array} layerToggles - Array of { key, label, layerGroup, defaultChecked }
   */
  function init(map, dimensionConfigs, layerToggles) {
    if (!map) {
      console.warn('Filter panel: map not ready, retrying...');
      setTimeout(function() { init(map, dimensionConfigs, layerToggles); }, 100);
      return;
    }

    dimensionConfigs = dimensionConfigs || [];
    layerToggles = layerToggles || [];

    FilterPanelControl = L.Control.extend({
      options: { position: 'topleft' },

      onAdd: function() {
        var container = L.DomUtil.create('div', 'filter-panel leaflet-bar');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        // Toggle button
        var toggleBtn = L.DomUtil.create('button', 'filter-panel-toggle', container);
        toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
        toggleBtn.setAttribute('type', 'button');
        toggleBtn.setAttribute('aria-label', 'Toggle filter panel');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('data-tinylytics-event', 'filter.toggle');

        // Content area
        var content = L.DomUtil.create('div', 'filter-panel-content', container);

        // Spot filter section -- one fieldset per dimension
        for (var i = 0; i < dimensionConfigs.length; i++) {
          var dim = dimensionConfigs[i];
          var fieldset = document.createElement('fieldset');
          var legend = document.createElement('legend');
          legend.textContent = dim.label;
          fieldset.appendChild(legend);

          var options = dim.options || [];
          for (var j = 0; j < options.length; j++) {
            var opt = options[j];
            var label = document.createElement('label');
            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.setAttribute('data-dimension', dim.key);
            checkbox.setAttribute('data-slug', opt.slug);
            checkbox.setAttribute('data-tinylytics-event', 'filter.change');
            checkbox.setAttribute('data-tinylytics-event-value', dim.key + ':' + opt.slug);

            checkbox.addEventListener('change', (function(dimKey, slug) {
              return function(e) {
                if (global.PaddelbuchFilterEngine) {
                  global.PaddelbuchFilterEngine.setOption(dimKey, slug, e.target.checked);
                  global.PaddelbuchFilterEngine.applyFilters();
                }
              };
            })(dim.key, opt.slug));

            label.appendChild(checkbox);

            // Add colored circle with icon for spot type options
            if (opt.icon && opt.colorClass) {
              var circle = document.createElement('span');
              circle.className = 'filter-icon-circle filter-icon-circle--' + opt.colorClass;
              var icon = document.createElement('img');
              icon.src = opt.icon;
              icon.alt = '';
              icon.className = 'filter-icon-circle-img';
              circle.appendChild(icon);
              label.appendChild(circle);
            } else if (opt.icon && opt.beadClass) {
              // Bead: white disc with coloured border + coloured glyph, mirroring
              // the spot tip Beads drawn on the map markers.
              var bead = document.createElement('span');
              bead.className = 'filter-icon-bead filter-icon-bead--' + opt.beadClass;
              var beadImg = document.createElement('img');
              beadImg.src = opt.icon;
              beadImg.alt = '';
              beadImg.className = 'filter-icon-bead-img';
              bead.appendChild(beadImg);
              label.appendChild(bead);
            } else if (opt.icon && opt.iconOnly) {
              var standaloneImg = document.createElement('img');
              standaloneImg.src = opt.icon;
              standaloneImg.alt = '';
              standaloneImg.className = 'filter-icon-standalone';
              label.appendChild(standaloneImg);
            }

            label.appendChild(document.createTextNode(opt.label));
            fieldset.appendChild(label);
          }

          content.appendChild(fieldset);
        }

        // Separator between spot filters and layer toggles
        if (dimensionConfigs.length > 0 && layerToggles.length > 0) {
          var separator = document.createElement('hr');
          separator.className = 'filter-panel-separator';
          content.appendChild(separator);
        }

        // Layer toggle section
        for (var k = 0; k < layerToggles.length; k++) {
          var toggle = layerToggles[k];
          var layerLabel = document.createElement('label');
          var layerCheckbox = document.createElement('input');
          layerCheckbox.type = 'checkbox';
          layerCheckbox.checked = !!toggle.defaultChecked;
          layerCheckbox.setAttribute('data-layer', toggle.key);
          layerCheckbox.setAttribute('data-tinylytics-event', 'layer.toggle');
          layerCheckbox.setAttribute('data-tinylytics-event-value', toggle.key);

          layerCheckbox.addEventListener('change', (function(tgl) {
            return function(e) {
              if (e.target.checked) {
                tgl.layerGroup.addTo(map);
              } else {
                tgl.layerGroup.remove();
              }
            };
          })(toggle));

          layerLabel.appendChild(layerCheckbox);

          // Add colored circle with icon for layer toggles that have icon metadata
          if (toggle.icon && toggle.colorClass) {
            var layerCircle = document.createElement('span');
            layerCircle.className = 'filter-icon-circle filter-icon-circle--' + toggle.colorClass;
            var layerIcon = document.createElement('img');
            layerIcon.src = toggle.icon;
            layerIcon.alt = '';
            layerIcon.className = 'filter-icon-circle-img';
            layerCircle.appendChild(layerIcon);
            layerLabel.appendChild(layerCircle);
          } else if (toggle.icon && toggle.iconOnly) {
            var standaloneIcon = document.createElement('img');
            standaloneIcon.src = toggle.icon;
            standaloneIcon.alt = '';
            standaloneIcon.className = 'filter-icon-standalone';
            layerLabel.appendChild(standaloneIcon);
          }

          layerLabel.appendChild(document.createTextNode(toggle.label));
          content.appendChild(layerLabel);
        }

        // Toggle expand/collapse
        toggleBtn.addEventListener('click', function() {
          var isExpanded = L.DomUtil.hasClass(container, 'expanded');
          if (isExpanded) {
            L.DomUtil.removeClass(container, 'expanded');
            toggleBtn.setAttribute('aria-expanded', 'false');
          } else {
            L.DomUtil.addClass(container, 'expanded');
            toggleBtn.setAttribute('aria-expanded', 'true');
          }
        });

        // Store references for popup collapse behavior
        this._container = container;
        this._toggleBtn = toggleBtn;

        return container;
      }
    });

    controlInstance = new FilterPanelControl();
    controlInstance.addTo(map);

    // Collapse on popupopen so the panel does not cover popup content
    // (Requirement 5.8), then move the popup clear of the controls if it still
    // overlaps them.
    //
    // This deliberately does NOT touch the control corner's z-index. Forcing it
    // to 0 (as an earlier implementation did) drops the whole corner below
    // .leaflet-map-pane, whose stacking context sits at z-index 400 -- so every
    // marker in .leaflet-marker-pane (600) then paints OVER the filter panel and
    // the search box, and swallows clicks meant for them. That is worse than the
    // problem it solved: a popup is transient and dismissible, whereas the
    // controls are the user's only way to filter or search.
    var controlCorner = controlInstance.getContainer().parentNode;
    map.on('popupopen', function(e) {
      L.DomUtil.removeClass(controlInstance.getContainer(), 'expanded');
      controlInstance._toggleBtn.setAttribute('aria-expanded', 'false');
      panPopupClearOfControls(map, e && e.popup, controlCorner);
    });
  }

  /**
   * Pan the map just far enough that an open popup is not hidden behind the
   * map controls.
   *
   * The controls sit above the map's panes, which is what keeps markers from
   * covering them -- but it also means a popup opening under the control cluster
   * is clipped by it. Leaflet's own autoPan only keeps a popup inside the
   * VIEWPORT; it has no notion of a control being in the way. So once the popup
   * is placed, measure the actual overlap and shift the view by exactly that
   * much, which moves the popup out from under the controls.
   *
   * Only pans when there is a real overlap, so the common case (a popup nowhere
   * near the corner) does not move the map at all.
   *
   * @param {L.Map} map
   * @param {L.Popup} popup
   * @param {HTMLElement} corner - The Leaflet control corner holding the controls.
   */
  function panPopupClearOfControls(map, popup, corner) {
    if (!popup || typeof popup.getElement !== 'function' || !corner) {
      return;
    }
    var popupEl = popup.getElement();
    if (!popupEl || typeof popupEl.getBoundingClientRect !== 'function') {
      return;
    }
    var p = popupEl.getBoundingClientRect();
    var c = corner.getBoundingClientRect();
    if (!c.width || !c.height || !p.width || !p.height) {
      return;
    }
    var overlapX = Math.min(p.right, c.right) - Math.max(p.left, c.left);
    var overlapY = Math.min(p.bottom, c.bottom) - Math.max(p.top, c.top);
    if (overlapX <= 0 || overlapY <= 0) {
      return;
    }
    // Cap the shift so a popup taller than the map cannot fling the marker off
    // screen; a partially covered popup beats losing the spot the user clicked.
    var limit = Math.floor(map.getSize().y / 2);
    var shift = Math.min(Math.ceil(overlapY) + POPUP_CONTROL_GAP, limit);
    if (shift > 0) {
      // Negative y pans the view up, which moves the popup DOWN the screen and
      // out from under the controls.
      map.panBy([0, -shift]);
    }
  }

  global.PaddelbuchFilterPanel = {
    init: init
  };

})(typeof window !== 'undefined' ? window : this);