import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql } from "gatsby";
import { Marker, Popup, GeoJSON } from "react-leaflet";
import { Container, Row, Col } from "react-bootstrap";
import * as layerStyle from 'data/layer-styles';
import { RichText } from '@graphcms/rich-text-react-renderer';
import { isDomAvailable } from 'lib/util';
import L from "leaflet";
import  { markerStyles } from 'data/marker-styles';
import { Link, Trans, useTranslation } from 'gatsby-plugin-react-i18next';

export const pageQuery = graphql`
query ObstaclePageQuery($slug: String!, $language: GraphCMS_Locale!) {
  locales: allLocale(
    filter: {language: {eq: $language}}
  ) {
    edges {
      node {
        ns
        data
        language
      }
    }
  }
  thisObstacle: graphCmsObstacle(locale: {eq: $language}, slug: {eq: $slug}) {
    name
    slug
    geometry
    spots {
      slug
      name
      description {
        raw
      }
      location {
        latitude
        longitude
      }
      spotType {
        name
        slug
      }
    }
    obstacleType {
      name
    }
    portageRoute
    portageDistance
    portageDescription {
      raw
    }
    description {
      raw
    }
    waterway {
      slug
      name
    }
  }
  spots: allGraphCmsSpot(filter: {locale: {eq: $language}}) {
    nodes {
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
      slug
    }
  }
  protectedAreas: allGraphCmsProtectedArea(filter: {locale: {eq: $language}}) {
    nodes {
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
  obstacles: allGraphCmsObstacle(filter: {locale: {eq: $language}}) {
    nodes {
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
`;

export default function ObstacleDetailsPage({ data: { thisObstacle, spots, protectedAreas, obstacles } }) {

  const {t} = useTranslation();

  var spotEinsteigAufsteigIcon
  var spotNurEinsteigIcon
  var spotNurAufsteigIcon
  var spotRasthalteIcon
  var spotNotauswasserungIcon
  var mapSettings
  var obstacleCentre

  if (isDomAvailable()) {
    spotEinsteigAufsteigIcon = new L.icon(markerStyles.spotEinsteigAufsteigIcon)
    spotNurEinsteigIcon = new L.icon(markerStyles.spotNurEinsteigIcon)
    spotNurAufsteigIcon = new L.icon(markerStyles.spotNurAufsteigIcon)
    spotRasthalteIcon = new L.icon(markerStyles.spotRasthalteIcon)
    spotNotauswasserungIcon = new L.icon(markerStyles.spotNotauswasserungIcon)

    const geometryL = L.geoJSON(thisObstacle.geometry)
    const obstacleBounds = geometryL.getBounds()
    obstacleCentre = obstacleBounds.getCenter()
    mapSettings = {
      bounds: obstacleBounds,
    };   
  }

  if ( ! thisObstacle.description ) {
    return(
      <Layout pageName="obstacle-details">
        <Helmet>
          <title>{t(`Paddel Buch - Obstacles`)} - {thisObstacle.name}</title>
        </Helmet>
        <Container fluid >
          <Row className="justify-content-center g-0">
            <Col id="map" xl="8" lg="8" md="12" sm="12" xs="12">
              <Map {...mapSettings}>
                
              { spots.nodes
              .filter(spot => spot.spotType.slug === "einsteig-aufsteig")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotEinsteigAufsteigIcon) ? spotEinsteigAufsteigIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                      <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                      <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                      <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                      <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>}
                  </Marker>
                );
              })}

              { spots.nodes
                .filter(spot => spot.spotType.slug === "nur-einsteig")
                .map(spot => {
                  const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                  const position = [location.latitude, location.longitude];
                  return (
                    <Marker key={slug} position={position} icon={(!!spotNurEinsteigIcon) ? spotNurEinsteigIcon : null}>
                      {<Popup>
                        <b>{name}</b>
                        <RichText content={description.raw} />
                        <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                        <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                        <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                        <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                        <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                      </Popup>}
                    </Marker>
                  );
              })}

              { spots.nodes
                .filter(spot => spot.spotType.slug === "nur-aufsteig")
                .map(spot => {
                  const { name, location, description, waterways, slug, approximateAddress, spotType  } = spot;
                  const position = [location.latitude, location.longitude];
                  return (
                    <Marker key={slug} position={position} icon={(!!spotNurAufsteigIcon) ? spotNurAufsteigIcon : null}>
                      {<Popup>
                        <b>{name}</b>
                        <RichText content={description.raw} />
                        <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                        <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                        <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                        <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                        <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                      </Popup>}
                    </Marker>
                  );
              })}

              { spots.nodes
                .filter(spot => spot.spotType.slug === "rasthalte")
                .map(spot => {
                  const { name, location, description, waterways, slug, approximateAddress, spotType  } = spot;
                  const position = [location.latitude, location.longitude];
                  return (
                    <Marker key={slug} position={position} icon={(!!spotRasthalteIcon) ? spotRasthalteIcon : null}>
                      {<Popup>
                        <b>{name}</b>
                        <RichText content={description.raw} />
                        <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                        <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                        <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                        <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                      <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                      </Popup>}
                    </Marker>
                  );
              })}

              { spots.nodes
                .filter(spot => spot.spotType.slug === "notauswasserungsstelle")
                .map(spot => {
                  const { name, location, description, waterways, slug, approximateAddress, spotType  } = spot;
                  const position = [location.latitude, location.longitude];
                  return (
                    <Marker key={slug} position={position} icon={(!!spotNotauswasserungIcon) ? spotNotauswasserungIcon : null}>
                      {<Popup>
                        <b>{name}</b>
                        <RichText content={description.raw} />
                        <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                        <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                        <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                        <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                      <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                      </Popup>}
                    </Marker>
                  );
              })}

              { protectedAreas.nodes
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

              </Map>
            </Col>
            <Col className="obstacle-description" xl="4" lg="4" md="12" sm="12" xs="12">
              <div className="obstacle-title">
                <h1>{thisObstacle.name}</h1>
              </div>
              <p><b><Trans>Type</Trans>:</b> {thisObstacle.obstacleType.name}</p>
              <p><b><Trans>GPS</Trans>:</b> {(!!obstacleCentre) ? obstacleCentre["lat"] : null}, {(!!obstacleCentre) ? obstacleCentre["lng"] : null}</p>
              <p><b><Trans>Waterway</Trans>:</b> <Link to={`/gewaesser/${thisObstacle.waterway.slug}`}>{thisObstacle.waterway.name}</Link></p>
            </Col>
          </Row>
        </Container>
      </Layout>
    )
  }
  else {
    return(
      <Layout pageName="obstacle-details">
        <Helmet>
          <title>{t(`Paddel Buch - Obstacles`)} - {thisObstacle.name}</title>
        </Helmet>
        <Container fluid >
          <Row className="justify-content-center g-0">
            <Col id="map" xl="8" lg="8" md="12" sm="12" xs="12">
              <Map {...mapSettings}>
                

              { spots.nodes
              .filter(spot => spot.spotType.slug === "einsteig-aufsteig")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotEinsteigAufsteigIcon) ? spotEinsteigAufsteigIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                      <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                      <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                      <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                      <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>}
                  </Marker>
                );
            })}

            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-einsteig")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurEinsteigIcon) ? spotNurEinsteigIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                      <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                      <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                      <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                      <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>}
                  </Marker>
                );
            })}

            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-aufsteig")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType  } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurAufsteigIcon) ? spotNurAufsteigIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                      <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                      <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                      <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                      <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>}
                  </Marker>
                );
            })}

            { spots.nodes
              .filter(spot => spot.spotType.slug === "rasthalte")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType  } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotRasthalteIcon) ? spotRasthalteIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                      <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                      <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                      <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                    <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>}
                  </Marker>
                );
            })}

            { protectedAreas.nodes
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

              </Map>
            </Col>
            <Col className="obstacle-description" xl="4" lg="4" md="12" sm="12" xs="12">
              <div className="obstacle-title">
                <h1>{thisObstacle.name}</h1>
              </div>
              <RichText content={thisObstacle.description.raw} />
              <p><b><Trans>Type</Trans>:</b> {thisObstacle.obstacleType.name}</p>
              <p><b><Trans>GPS</Trans>:</b> {(!!obstacleCentre) ? obstacleCentre["lat"] : null}, {(!!obstacleCentre) ? obstacleCentre["lng"] : null}</p>
              <p><b><Trans>Waterway</Trans>:</b> <Link to={`/gewaesser/${thisObstacle.waterway.slug}`}>{thisObstacle.waterway.name}</Link></p>
              <h2><Trans>Portage Route</Trans></h2>
              <RichText content={thisObstacle.portageDescription.raw} />
              <p><b><Trans>Distance</Trans>:</b> {thisObstacle.portageDistance}m</p>
              <p><b><Trans>Exit Spot</Trans>:</b> <Link to={`/einsteigsorte/${thisObstacle.spots.filter(spot => spot.spotType.slug === "nur-aufsteig")[0].slug}`}>{thisObstacle.spots.filter(spot => spot.spotType.slug === "nur-aufsteig")[0].name}</Link></p>
              <p><b><Trans>Re-entry Spot</Trans>:</b> <Link to={`/einsteigsorte/${thisObstacle.spots.filter(spot => spot.spotType.slug === "nur-einsteig")[0].slug}`}>{thisObstacle.spots.filter(spot => spot.spotType.slug === "nur-einsteig")[0].name}</Link></p>    
            </Col>
          </Row>
        </Container>
      </Layout>
    )
  }
};