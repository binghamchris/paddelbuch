import React from "react";
import PropTypes from "prop-types";
import { MapContainer, TileLayer, ZoomControl, Marker, Popup, GeoJSON, LayerGroup, LayersControl } from "react-leaflet";
import { useConfigureLeaflet } from "hooks";
import { isDomAvailable } from "lib/util";
import { graphql, useStaticQuery } from "gatsby";
import * as layerStyle from 'data/layer-styles';
import { markerStyles } from 'data/marker-styles';
import { RichText } from '@graphcms/rich-text-react-renderer';
import { Link, Trans, I18nextContext, useTranslation } from 'gatsby-plugin-react-i18next';
import L from "leaflet";
import entryExitWhite from "assets/images/icons/entryexit-white.png";
import entryWhite from "assets/images/icons/entry-white.png";
import exitWhite from "assets/images/icons/exit-white.png";
import emergencyWhite from "assets/images/icons/emergency-white.png";
import restWhite from "assets/images/icons/rest-white.png";

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
      spots: allGraphCmsSpot {
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
          description {
            raw
          }
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
      <MapContainer tap={false} {...mapSettings}>
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
                    {<Popup>
                      <div class="popup-icon-div">
                        <p><img src={entryExitWhite} class="popup-icon" alt={t('Entry and exit spot icon')}/> {spotType.name}</p>
                      </div>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <table class="popup-details-table">
                        <tr>
                          <th><Trans>Potentially Usable By</Trans>:</th>
                          <td>
                            <ul>
                              {potentiallyUsableBy
                                .map(paddleCraft => {
                                  const { name } = paddleCraft;
                                  return (
                                    <li>{name}</li>
                                  )
                                })
                              }
                            </ul>
                          </td>
                        </tr>
                        <tr>
                          <th><Trans>GPS</Trans>:</th>
                          <td>{location.latitude}, {location.longitude}</td>
                        </tr>
                        <tr>
                          <th><Trans>Approx. Address</Trans>:</th>
                          <td>{approximateAddress}</td>
                        </tr>
                      </table>
                      <Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link>
                    </Popup>}
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
                    {<Popup>
                      <div class="popup-icon-div">
                        <p><img src={entryWhite} class="popup-icon" alt={t('Entry spot icon')}/> {spotType.name}</p>
                      </div>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <table class="popup-details-table">
                        <tr>
                          <th><Trans>Potentially Usable By</Trans>:</th>
                          <td>
                            <ul>
                              {potentiallyUsableBy
                                .map(paddleCraft => {
                                  const { name } = paddleCraft;
                                  return (
                                    <li>{name}</li>
                                  )
                                })
                              }
                            </ul>
                          </td>
                        </tr>
                        <tr>
                          <th><Trans>GPS</Trans>:</th>
                          <td>{location.latitude}, {location.longitude}</td>
                        </tr>
                        <tr>
                          <th><Trans>Approx. Address</Trans>:</th>
                          <td>{approximateAddress}</td>
                        </tr>
                      </table>
                      <Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link>
                    </Popup>}
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
                    {<Popup>
                      <div class="popup-icon-div">
                        <p><img src={exitWhite} class="popup-icon" alt={t('Exit spot icon')}/> {spotType.name}</p>
                      </div>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <table class="popup-details-table">
                        <tr>
                          <th><Trans>Potentially Usable By</Trans>:</th>
                          <td>
                            <ul>
                              {potentiallyUsableBy
                                .map(paddleCraft => {
                                  const { name } = paddleCraft;
                                  return (
                                    <li>{name}</li>
                                  )
                                })
                              }
                            </ul>
                          </td>
                        </tr>
                        <tr>
                          <th><Trans>GPS</Trans>:</th>
                          <td>{location.latitude}, {location.longitude}</td>
                        </tr>
                        <tr>
                          <th><Trans>Approx. Address</Trans>:</th>
                          <td>{approximateAddress}</td>
                        </tr>
                      </table>
                      <Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link>
                    </Popup>}
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
                    {<Popup>
                      <div class="popup-icon-div">
                        <p><img src={restWhite} class="popup-icon" alt={t('Rest spot icon')}/> {spotType.name}</p>
                      </div>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <table class="popup-details-table">
                        <tr>
                          <th><Trans>Potentially Usable By</Trans>:</th>
                          <td>
                            <ul>
                              {potentiallyUsableBy
                                .map(paddleCraft => {
                                  const { name } = paddleCraft;
                                  return (
                                    <li>{name}</li>
                                  )
                                })
                              }
                            </ul>
                          </td>
                        </tr>
                        <tr>
                          <th><Trans>GPS</Trans>:</th>
                          <td>{location.latitude}, {location.longitude}</td>
                        </tr>
                        <tr>
                          <th><Trans>Approx. Address</Trans>:</th>
                          <td>{approximateAddress}</td>
                        </tr>
                      </table>
                      <Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link>
                    </Popup>}
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
                    {<Popup>
                      <div class="popup-icon-div">
                        <p><img src={emergencyWhite} class="popup-icon" alt={t('Emergency exit spot icon')}/> {spotType.name}</p>
                      </div>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <table class="popup-details-table">
                        <tr>
                          <th><Trans>Potentially Usable By</Trans>:</th>
                          <td>
                            <ul>
                              {potentiallyUsableBy
                                .map(paddleCraft => {
                                  const { name } = paddleCraft;
                                  return (
                                    <li>{name}</li>
                                  )
                                })
                              }
                            </ul>
                          </td>
                        </tr>
                        <tr>
                          <th><Trans>GPS</Trans>:</th>
                          <td>{location.latitude}, {location.longitude}</td>
                        </tr>
                        <tr>
                          <th><Trans>Approx. Address</Trans>:</th>
                          <td>{approximateAddress}</td>
                        </tr>
                      </table>
                      <Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link>
                    </Popup>}
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
                    <b>{name}</b>
                    <br />{protectedAreaType.name}
                  </Popup>
                </GeoJSON>
              )              
            })}

            { obstacles.nodes
              .filter(obstacles => obstacles.locale === language)
              .map(obstacle => {
              const { name, geometry, obstacleType, portageRoute, slug } = obstacle;
              return (
                <div>
                  <GeoJSON data={geometry} style={layerStyle.obstacleStyle}>
                    <Popup>
                      <b>{name}</b>
                      <br />{obstacleType.name}
                      <p><Link to={`/hindernisse/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>
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
