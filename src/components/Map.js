import React from "react";
import PropTypes from "prop-types";
import { MapContainer, WMSTileLayer, ZoomControl } from "react-leaflet";
import { useConfigureLeaflet } from "hooks";
import { isDomAvailable } from "lib/util";

const Map = (props) => {
  
  const {
    children,
    className,
    ...rest
  } = props;

  useConfigureLeaflet();

  let mapClassName = `map`;

  if (className) {
    mapClassName = `${mapClassName} ${className}`;
  }

  if (!isDomAvailable()) {
    return (
      <div className={mapClassName}>
        <p className="map-loading">Loading map...</p>
      </div>
    );
  }

  const mapSettings = {
    className: "map-base",
    zoomControl: false,
    
    ...rest,
  };

const mapboxUrl = process.env.GATSBY_MAPBOX_URL

  return (
    <div className={mapClassName}>
      <MapContainer tap={false} {...mapSettings}>
        {children}
        {/* {basemap && <TileLayer {...basemap} />} */}
        <WMSTileLayer
          url = {mapboxUrl}
          attribution="© <a href='https://www.mapbox.com/about/maps/' target='_blank' rel='noopener'>Mapbox</a> © <a href='http://www.openstreetmap.org/copyright' target='_blank' rel='noopener'>OpenStreetMap</a> <strong><a href='https://www.mapbox.com/map-feedback/' target='_blank' rel='noopener'>Improve this map</a></strong>"
          header={{Authorization: "https://test.localhost"}}
        />
        <ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
};

Map.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  defaultBaseMap: PropTypes.string,
};


export default Map;
