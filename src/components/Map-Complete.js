import React from "react";
import PropTypes from "prop-types";
import { MapContainer, TileLayer, ZoomControl, Marker, Popup, GeoJSON, LayerGroup, LayersControl } from "react-leaflet";
import { useConfigureLeaflet } from "hooks";
import { isDomAvailable } from "lib/util";
import { graphql, useStaticQuery } from "gatsby";
import * as layerStyle from 'data/layer-styles';
import { markerStyles } from 'data/marker-styles';
import { Trans, I18nextContext, useTranslation } from '@herob191/gatsby-plugin-react-i18next';
import L from "leaflet";
import MapSpotPopup from 'components/Map-Spot-Popup';
import MapObstaclePopup from 'components/Map-Obstacle-Popup';
import MapEventNoticePopup from 'components/Map-EventNotice-Popup';
import MapRejectedSpotPopup from 'components/Map-RejectedSpot-Popup';
import AddLocate from "components/Map-LocateControl";

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

  const { spots, protectedAreas, obstacles, waterwayEventNotices, rejectedSpots } = useStaticQuery(graphql`
    query {
      spots: allContentfulSpot(filter: {rejected: {ne: true}}) {
        nodes {
          node_locale
          name
          approximateAddress {
            approximateAddress
          }
          description {
            raw
          }
          location {
            lat
            lon
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
            internal {
              content
            }
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
            internal {
              content
            }
          }
          geometry {
            internal {
              content
            }
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
            lat
            lon
          }
          affectedArea {
            internal {
              content
            }
          }
          description {
            raw
          }
          endDate
          startDate
        }
      }
      rejectedSpots: allContentfulSpot(filter: {rejected: {eq: true}}) {
        nodes {
          node_locale
          name
          approximateAddress {
            approximateAddress
          }
          description {
            raw
          }
          location {
            lat
            lon
          }
          slug
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
  var rejectedSpotIcon

  if (isDomAvailable()) {
    spotEinstiegAufstiegIcon = new L.icon(markerStyles.spotEinstiegAufstiegIcon)
    spotNurEinstiegIcon = new L.icon(markerStyles.spotNurEinstiegIcon)
    spotNurAufstiegIcon = new L.icon(markerStyles.spotNurAufstiegIcon)
    spotRasthalteIcon = new L.icon(markerStyles.spotRasthalteIcon)
    spotNotauswasserungIcon = new L.icon(markerStyles.spotNotauswasserungIcon)
    waterwayEventNoticeIcon = new L.icon(markerStyles.waterwayEventNoticeIcon)
    rejectedSpotIcon = new L.icon(markerStyles.rejectedSpotIcon)
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
        <TileLayer
          url = {mapboxUrl}
          attribution="© <a href='https://www.mapbox.com/about/maps/' target='_blank' rel='noopener'>Mapbox</a> © <a href='http://www.openstreetmap.org/copyright' target='_blank' rel='noopener'>OpenStreetMap</a> <strong><a href='https://www.mapbox.com/map-feedback/' target='_blank' rel='noopener'>Improve this map</a></strong>"
          maxZoom = "20"
        />
        <ZoomControl key="zoom-control" position="bottomright" />
        <AddLocate />
        <LayersControl key="layer-control" position="topleft" collapsed='false'>
          <LayersControl.Overlay key="entry-exit" checked name={t("Entry & Exit Spots")}>
            <LayerGroup key="entry-exit-group">
            { spots.nodes
              .filter(spot => spot.spotType.slug === "einstieg-aufstieg" && spot.node_locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, paddleCraftType } = spot;
                const position = [location.lat, location.lon];
                return (
                  <Marker key={slug} position={position} icon={(!!spotEinstiegAufstiegIcon) ? spotEinstiegAufstiegIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress.approximateAddress} spotType={spotType} paddleCraftType={paddleCraftType}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay key="entry" checked name={t("Entry Only Spots")}>
            <LayerGroup key="entry-group">
            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-einstieg" && spot.node_locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, paddleCraftType } = spot;
                const position = [location.lat, location.lon];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurEinstiegIcon) ? spotNurEinstiegIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress.approximateAddress} spotType={spotType} paddleCraftType={paddleCraftType}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay key="exit" checked name={t("Exit Only Spots")}>
            <LayerGroup key="exit-group">
            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-aufstieg" && spot.node_locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, paddleCraftType } = spot;
                const position = [location.lat, location.lon];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurAufstiegIcon) ? spotNurAufstiegIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress.approximateAddress} spotType={spotType} paddleCraftType={paddleCraftType}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay key="rest" checked name={t("Rest Spots")}>
            <LayerGroup key="rest-group">
            { spots.nodes
              .filter(spot => spot.spotType.slug === "rasthalte" && spot.node_locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, paddleCraftType } = spot;
                const position = [location.lat, location.lon];
                return (
                  <Marker key={slug} position={position} icon={(!!spotRasthalteIcon) ? spotRasthalteIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress.approximateAddress} spotType={spotType} paddleCraftType={paddleCraftType}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay key="emergency" checked name={t("Emergency Exit Spots")}>
            <LayerGroup key="emergency-group">
            { spots.nodes
              .filter(spot => spot.spotType.slug === "notauswasserungsstelle" && spot.node_locale === language)
              .map(spot => {
                const { name, location, description, slug, approximateAddress, spotType, paddleCraftType } = spot;
                const position = [location.lat, location.lon];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNotauswasserungIcon) ? spotNotauswasserungIcon : null}>
                    {<MapSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress.approximateAddress} spotType={spotType} paddleCraftType={paddleCraftType}/>}
                  </Marker>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>
          <LayersControl.Overlay key="event" checked name={t("Waterway Event Notices")}>
            <LayerGroup key="event-group">
            { waterwayEventNotices.nodes
              .filter(waterwayEventNotice => new Date(waterwayEventNotice.endDate) - new Date() > 0 && waterwayEventNotice.node_locale === language)
              .map(waterwayEventNotice => {
                const { name, slug, location, affectedArea, endDate, startDate, description } = waterwayEventNotice;
                const position = [location.lat, location.lon];
                return (
                  <div>
                    <Marker key="{slug}-marker" position={position} icon={(!!waterwayEventNoticeIcon) ? waterwayEventNoticeIcon : null}>
                      {<MapEventNoticePopup name={name} location={location} description={description} slug={slug} startDate={startDate} endDate={endDate} />}
                    </Marker>
                    <GeoJSON key="{slug}-geojson" data={JSON.parse(affectedArea.internal.content)} style={layerStyle.waterwayEventNoticeAreaStyle}>
                      {<MapEventNoticePopup name={name} location={location} description={description} slug={slug} startDate={startDate} endDate={endDate} />}
                    </GeoJSON>
                  </div>
                );
            })}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay key="rejected" name={t("No Entry Spots")}>
            <LayerGroup key="rejected-group">
            { rejectedSpots.nodes
              .filter(rejectedSpot => rejectedSpot.node_locale === language)
              .map(rejectedSpot => {
                const { name, location, description, slug, approximateAddress } = rejectedSpot;
                const position = [location.lat, location.lon];
                return (
                  <Marker key={slug} position={position} icon={(!!rejectedSpotIcon) ? rejectedSpotIcon : null}>
                    {<MapRejectedSpotPopup name={name} location={location} description={description} slug={slug} approximateAddress={approximateAddress.approximateAddress}/>}
                  </Marker>
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
              <GeoJSON key={slug} data={JSON.parse(geometry.internal.content)} style={layerStyle.protectedAreaStyle}>
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
                <GeoJSON key={slug} data={JSON.parse(geometry.internal.content)} style={layerStyle.obstacleStyle}>
                  <MapObstaclePopup name={name} isPortagePossible={isPortagePossible} slug={slug}/>
                </GeoJSON>
                {portageRoute ? <GeoJSON data={JSON.parse(portageRoute.internal.content)} style={layerStyle.portageStyle}>
                  <Popup><b><Trans>Portage route for</Trans> {name}</b></Popup>
                </GeoJSON>: null }
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