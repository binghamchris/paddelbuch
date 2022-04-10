import React from "react";
import PropTypes from "prop-types";
import { MapContainer, TileLayer, ZoomControl, Marker, Popup, GeoJSON, LayerGroup, LayersControl } from "react-leaflet";
import { useConfigureLeaflet } from "hooks";
import { isDomAvailable } from "lib/util";
import { graphql, useStaticQuery } from "gatsby";
import * as layerStyle from 'data/layer-styles';
import { markerStyles } from 'data/marker-styles';
import { Trans, I18nextContext, useTranslation } from 'gatsby-plugin-react-i18next';
import L from "leaflet";
import MapSpotPopup from 'components/Map-Spot-Popup';
import MapObstaclePopup from 'components/Map-Obstacle-Popup';

const Map = (props) => {

  const {t} = useTranslation();
  const context = React.useContext(I18nextContext);
  const language = context.language
  
  const {
    children,
    className,
    ...rest
  } = props;

  useConfigureLeaflet();

  const { spots, protectedAreas, obstacles, } = useStaticQuery(graphql`
    query {
      spots: allGraphCmsSpot(filter: {rejected: {ne: true}}) {
        nodes {
          locale
          name
          approximateAddress
          description {
            html
            raw
          }
          location {
            latitude
            longitude
          }
          waterways {
            name
            slug
          }
          spotType {
            name
            slug
          }
          potentiallyUsableBy {
            name
            id
          }
          slug
        }
      }
      protectedAreas: allGraphCmsProtectedArea {
        nodes {
          locale
          name
          geometry
          slug
          protectedAreaType {
            name
            slug
          }
          isAreaMarked
        }
      }
      obstacles: allGraphCmsObstacle {
        nodes {
          locale
          slug
          portageRoute
          geometry
          name
          isPortageNecessary
          isPortagePossible
          obstacleType {
            name
            slug
          }
        }
      }
    }
  `);

  let mapClassName = `map`;

  if (className) {
    mapClassName = `${mapClassName} ${className}`;
  }

  var spotEinsteigAufsteigIcon
  var spotNurEinsteigIcon
  var spotNurAufsteigIcon
  var spotRasthalteIcon
  var spotNotauswasserungIcon

  if (isDomAvailable()) {
    spotEinsteigAufsteigIcon = new L.icon(markerStyles.spotEinsteigAufsteigIcon)
    spotNurEinsteigIcon = new L.icon(markerStyles.spotNurEinsteigIcon)
    spotNurAufsteigIcon = new L.icon(markerStyles.spotNurAufsteigIcon)
    spotRasthalteIcon = new L.icon(markerStyles.spotRasthalteIcon)
    spotNotauswasserungIcon = new L.icon(markerStyles.spotNotauswasserungIcon)
  }

  if (!isDomAvailable()) {

    return (
      <div className={mapClassName}>
        <p className="map-loading">Loading map...</p>
      </div>
    );
    
  }

  console.log(spotEinsteigAufsteigIcon)

  const mapSettings = {
    className: "map-base",
    zoomControl: false,
    maxZoom: 20,
    ...rest,
  };

  const mapboxUrl = process.env.GATSBY_MAPBOX_URL;

  return (
    <div className={mapClassName}>
      <MapContainer tap={false} {...mapSettings} key="map">
        {children}
        {/* {basemap && <TileLayer {...basemap} />} */}
        <TileLayer
          url = {mapboxUrl}
          attribution="© <a href='https://www.mapbox.com/about/maps/' target='_blank' rel='noopener'>Mapbox</a> © <a href='http://www.openstreetmap.org/copyright' target='_blank' rel='noopener'>OpenStreetMap</a> <strong><a href='https://www.mapbox.com/map-feedback/' target='_blank' rel='noopener'>Improve this map</a></strong>"
          maxZoom = "20"
        />
        <ZoomControl position="bottomright" />
        <LayersControl position="topleft" collapsed='false'>
          <LayersControl.Overlay checked name={t("Entry & Exit Spots")}>
            <LayerGroup>
            { spots.nodes
              .filter(spot => spot.spotType.slug === "einsteig-aufsteig" && spot.locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, potentiallyUsableBy } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotEinsteigAufsteigIcon) ? spotEinsteigAufsteigIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress} spotType={spotType} potentiallyUsableBy={potentiallyUsableBy}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay checked name={t("Entry Only Spots")}>
            <LayerGroup>
            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-einsteig" && spot.locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, potentiallyUsableBy } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurEinsteigIcon) ? spotNurEinsteigIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress} spotType={spotType} potentiallyUsableBy={potentiallyUsableBy}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay checked name={t("Exit Only Spots")}>
            <LayerGroup>
            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-aufsteig" && spot.locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, potentiallyUsableBy } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurAufsteigIcon) ? spotNurAufsteigIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress} spotType={spotType} potentiallyUsableBy={potentiallyUsableBy}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay checked name={t("Rest Spots")}>
            <LayerGroup>
            { spots.nodes
              .filter(spot => spot.spotType.slug === "rasthalte" && spot.locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, potentiallyUsableBy } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotRasthalteIcon) ? spotRasthalteIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress} spotType={spotType} potentiallyUsableBy={potentiallyUsableBy}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay checked name={t("Emergency Exit Spots")}>
            <LayerGroup>
            { spots.nodes
              .filter(spot => spot.spotType.slug === "notauswasserungsstelle" && spot.locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, potentiallyUsableBy } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNotauswasserungIcon) ? spotNotauswasserungIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress} spotType={spotType} potentiallyUsableBy={potentiallyUsableBy}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>

            { protectedAreas.nodes
              .filter(protectedArea => protectedArea.locale === language)
              .map(protectedArea => {
              const { name, geometry, protectedAreaType } = protectedArea;
              return (
                <GeoJSON data={geometry} style={layerStyle.protectedAreaStyle}>
                  <Popup>
                    <span className="popup-title">
                      <h1>{name}</h1>
                    </span>
                    {protectedAreaType.name}
                  </Popup>
                </GeoJSON>
              )              
            })}

            { obstacles.nodes
              .filter(obstacles => obstacles.locale === language)
              .map(obstacle => {
              const { name, geometry, portageRoute, isPortagePossible, slug } = obstacle;
              return (
                <div>
                  <GeoJSON data={geometry} style={layerStyle.obstacleStyle}>
                    <MapObstaclePopup name={name} isPortagePossible={isPortagePossible} slug={slug}/>
                  </GeoJSON>
                  <GeoJSON data={portageRoute} style={layerStyle.portageStyle}>
                    <Popup><b><Trans>Portage route for</Trans> {name}</b></Popup>
                  </GeoJSON>
                </div>
              )            
              })}
          
        
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
