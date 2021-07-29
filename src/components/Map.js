import React from "react";
import PropTypes from "prop-types";
import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
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

  return (
    <div className={mapClassName}>
      <MapContainer {...mapSettings}>
        {children}
        {/* {basemap && <TileLayer {...basemap} />} */}
        <TileLayer
          url = {process.env.MAPBOX_URL}
          attribution="© <a href='https://www.mapbox.com/about/maps/'>Mapbox</a> © <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a> <strong><a href='https://www.mapbox.com/map-feedback/' target='_blank'>Improve this map</a></strong>"
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
