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
  query SpotPageQuery($slug: String!, $language: GraphCMS_Locale!) {
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
    graphCmsSpot(locale: {eq: $language}, slug: {eq: $slug}) {
      name
      approximateAddress
      description {
        raw
      }
      location {
        latitude
        longitude
      }
      waterways {
        name
        slug
        paddlingEnvironments {
          name
          slug
        }
        protectedAreas {
          name
          geometry
          slug
          protectedAreaType {
            name
            slug
          }
          isAreaMarked
        }
        obstacles {
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
          }
        }
        spots {
          name
          description {
            raw
          }
          location {
            latitude
            longitude
          }
          slug
          spotType {
            name
            slug
          }
        }
      }
      spotType {
        name
        slug
      }
      slug    
    }
  }
`;

export default function SpotDetailsPage({ data: { graphCmsSpot } }) {

  const {t} = useTranslation();

  var spotEinsteigAufsteigIcon
  var spotNurEinsteigIcon
  var spotNurAufsteigIcon
  var spotRasthalteIcon

  if (isDomAvailable()) {
    spotEinsteigAufsteigIcon = new L.icon(markerStyles.spotEinsteigAufsteigIcon)
    spotNurEinsteigIcon = new L.icon(markerStyles.spotNurEinsteigIcon)
    spotNurAufsteigIcon = new L.icon(markerStyles.spotNurAufsteigIcon)
    spotRasthalteIcon = new L.icon(markerStyles.spotRasthalteIcon)
  }

  const mapSettings = {
    center: [graphCmsSpot.location.latitude, graphCmsSpot.location.longitude],
    zoom: 16,
  };

  return(
    
    <Layout pageName="spot-details">
      <Helmet>
        <title>{t(`Swiss Paddel Buch - Spots`)} - {graphCmsSpot.name}</title>
      </Helmet>
      <Container fluid >
        <Row className="justify-content-center g-0">
          <Col id="map" xl="12" lg="12" md="12" sm="12" xs="12">
            <Map {...mapSettings}>

              { graphCmsSpot.waterways.protectedAreas.map(protectedArea => {
                const { name, geometry, protectedAreaType } = protectedArea;
                return (
                  <GeoJSON data={geometry} style={layerStyle.protectedAreaStyle}>
                    <Popup><b>{name}</b><br />{protectedAreaType.name}</Popup>
                  </GeoJSON>
                )
              
              })}

              { graphCmsSpot.waterways.obstacles.map(obstacle => {
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

              { graphCmsSpot.waterways.spots
              .filter(spot => spot.spotType.slug === "einsteig-aufsteig")
              .map(spot => {
              const { name, location, description, slug } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker key={slug} position={position} icon={(!!spotEinsteigAufsteigIcon) ? spotEinsteigAufsteigIcon : null}>
                  {<Popup>
                    <b>{name}</b>
                    <RichText content={description.raw} />
                    <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                  </Popup>}
                </Marker>
                );
              })}
              { graphCmsSpot.waterways.spots
              .filter(spot => spot.spotType.slug === "nur-einsteig")
              .map(spot => {
              const { name, location, description, slug } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker key={slug} position={position} icon={(!!spotNurEinsteigIcon) ? spotNurEinsteigIcon : null}>
                  {<Popup>
                    <b>{name}</b>
                    <RichText content={description.raw} />
                    <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                  </Popup>}
                </Marker>
                );
              })}
              { graphCmsSpot.waterways.spots
              .filter(spot => spot.spotType.slug === "nur-aufsteig")
              .map(spot => {
              const { name, location, description, slug } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker key={slug} position={position} icon={(!!spotNurAufsteigIcon) ? spotNurAufsteigIcon : null}>
                  {<Popup>
                    <b>{name}</b>
                    <RichText content={description.raw} />
                    <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                  </Popup>}
                </Marker>
                );
              })}
              { graphCmsSpot.waterways.spots
              .filter(spot => spot.spotType.slug === "rasthalte")
              .map(spot => {
              const { name, location, description, slug } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker key={slug} position={position} icon={(!!spotRasthalteIcon) ? spotRasthalteIcon : null}>
                  {<Popup>
                    <b>{name}</b>
                    <RichText content={description.raw} />
                    <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                  </Popup>}
                </Marker>
                );
              })}
            </Map>
          </Col>
        </Row>
        <Row className="justify-content-center g-0 spot-description spot-title">
          <Col>
            <h1>{graphCmsSpot.name}</h1>
          </Col>
        </Row>
        <Row className="justify-content-center g-0 spot-description">
          <Col xl="12" lg="12" md="12" sm="12" xs="12">
            <h2>Spot Details</h2>
            <RichText content={graphCmsSpot.description.raw} />
            <p><b><Trans>Type</Trans>:</b> {graphCmsSpot.spotType.name}</p>
            <p><b><Trans>GPS</Trans>:</b> {graphCmsSpot.location.latitude}, {graphCmsSpot.location.longitude}</p>
            <p><b><Trans>Approx. Address</Trans>:</b> {graphCmsSpot.approximateAddress}</p>
            <p><b><Trans>Waterway</Trans>:</b> <Link to={`/gewaesser/${graphCmsSpot.waterways.slug}`}>{graphCmsSpot.waterways.name}</Link></p>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};