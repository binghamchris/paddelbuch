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
import MapEventNoticePopup from 'components/Map-EventNotice-Popup';

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

  const { spots, protectedAreas, obstacles, waterwayEventNotices } = useStaticQuery(graphql`
    query {
      spots: allContentfulSpot(filter: {rejected: {ne: true}}) {
        nodes {
          node_locale
          name
          approximateAddress {
            json
          }
          description {
            json
          }
          location {
            latitude
            longitude
          }
          waterway {
            name
            slug
          }
          spotType {
            name
            slug
          }
          paddleCraftType {
            name
            id
          }
          slug
        }
      }
      protectedAreas: allContentfulProtectedArea {
        nodes {
          node_locale
          name
          geometry {
            json
          }
          slug
          protectedAreaType {
            name
            slug
          }
          isAreaMarked
        }
      }
      obstacles: allContentfulObstacle {
        nodes {
          node_locale
          slug
          portageRoute {
            json
          }
          geometry {
            json
          }
          name
          isPortageNecessary
          isPortagePossible
          obstacleType {
            name
            slug
          }
        }
      }
      waterwayEventNotices: allContentfulWaterwayEventNotice {
        nodes {
          slug
          updatedAt
          name
          node_locale
          location {
            latitude
            longitude
          }
          affectedArea {
            json
          }
          description {
            raw
          }
          endDate
          startDate
        }
      }
    }
  `);

  let mapClassName = `map`;

  if (className) {
    mapClassName = `${mapClassName} ${className}`;
  }

  var spotEinstiegAufstiegIcon
  var spotNurEinstiegIcon
  var spotNurAufstiegIcon
  var spotRasthalteIcon
  var spotNotauswasserungIcon
  var waterwayEventNoticeIcon

  if (isDomAvailable()) {
    spotEinstiegAufstiegIcon = new L.icon(markerStyles.spotEinstiegAufstiegIcon)
    spotNurEinstiegIcon = new L.icon(markerStyles.spotNurEinstiegIcon)
    spotNurAufstiegIcon = new L.icon(markerStyles.spotNurAufstiegIcon)
    spotRasthalteIcon = new L.icon(markerStyles.spotRasthalteIcon)
    spotNotauswasserungIcon = new L.icon(markerStyles.spotNotauswasserungIcon)
    waterwayEventNoticeIcon = new L.icon(markerStyles.waterwayEventNoticeIcon)
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
              .filter(spot => spot.spotType.slug === "einstieg-aufstieg" && spot.node_locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, potentiallyUsableBy } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotEinstiegAufstiegIcon) ? spotEinstiegAufstiegIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress} spotType={spotType} potentiallyUsableBy={potentiallyUsableBy}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay checked name={t("Entry Only Spots")}>
            <LayerGroup>
            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-einstieg" && spot.node_locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, potentiallyUsableBy } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurEinstiegIcon) ? spotNurEinstiegIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress} spotType={spotType} potentiallyUsableBy={potentiallyUsableBy}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay checked name={t("Exit Only Spots")}>
            <LayerGroup>
            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-aufstieg" && spot.node_locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, potentiallyUsableBy } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurAufstiegIcon) ? spotNurAufstiegIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress} spotType={spotType} potentiallyUsableBy={potentiallyUsableBy}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay checked name={t("Rest Spots")}>
            <LayerGroup>
            { spots.nodes
              .filter(spot => spot.spotType.slug === "rasthalte" && spot.node_locale === language)
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
              .filter(spot => spot.spotType.slug === "notauswasserungsstelle" && spot.node_locale === language)
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
          <LayersControl.Overlay checked name={t("Waterway Event Notices")}>
            <LayerGroup>
            { waterwayEventNotices.nodes
              .filter(waterwayEventNotice => new Date(waterwayEventNotice.endDate) - new Date() > 0 && waterwayEventNotice.node_locale === language)
              .map(waterwayEventNotice => {
                const { name, slug, location, affectedArea, endDate, startDate, description } = waterwayEventNotice;
                const position = [location.latitude, location.longitude];
                return (
                  <div>
                    <Marker key="{slug}-marker" position={position} icon={(!!waterwayEventNoticeIcon) ? waterwayEventNoticeIcon : null}>
                      {<MapEventNoticePopup name={name} location={location} description={description} slug={slug} startDate={startDate} endDate={endDate} />}
                    </Marker>
                    <GeoJSON key="{slug}-geojson" data={affectedArea} style={layerStyle.waterwayEventNoticeAreaStyle}>
                      {<MapEventNoticePopup name={name} location={location} description={description} slug={slug} startDate={startDate} endDate={endDate} />}
                    </GeoJSON>
                  </div>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>

            { protectedAreas.nodes
              .filter(protectedArea => protectedArea.node_locale === language)
              .map(protectedArea => {
              const { name, geometry, protectedAreaType, slug } = protectedArea;
              return (
                <GeoJSON key={slug} data={geometry} style={layerStyle.protectedAreaStyle}>
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
              .filter(obstacles => obstacles.node_locale === language)
              .map(obstacle => {
              const { name, geometry, portageRoute, isPortagePossible, slug } = obstacle;
              return (
                <div>
                  <GeoJSON key={slug} data={geometry} style={layerStyle.obstacleStyle}>
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
