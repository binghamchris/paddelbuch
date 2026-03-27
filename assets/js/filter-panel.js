(function(global) {
  'use strict';

  var FilterPanelControl = null;
  var controlInstance = null;

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

    // Collapse on popupopen, restore on popupclose (Requirement 5.8)
    var controlContainer = controlInstance.getContainer().parentNode;
    map.on('popupopen', function() {
      L.DomUtil.removeClass(controlInstance.getContainer(), 'expanded');
      controlInstance._toggleBtn.setAttribute('aria-expanded', 'false');
      controlContainer.style.zIndex = '0';
    });
    map.on('popupclose', function() {
      controlContainer.style.zIndex = '';
    });
  }

  global.PaddelbuchFilterPanel = {
    init: init
  };

})(typeof window !== 'undefined' ? window : this);