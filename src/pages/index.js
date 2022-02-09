import React from "react";
import { Helmet } from "react-helmet";
import { Marker, Popup, GeoJSON } from "react-leaflet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql } from "gatsby"
import { Container, Row, Col } from "react-bootstrap";
import { isDomAvailable } from 'lib/util';
import L from "leaflet";
import  { markerStyles } from 'data/marker-styles';
import { RichText } from '@graphcms/rich-text-react-renderer';
import { Link, Trans } from 'gatsby-plugin-react-i18next';
import * as layerStyle from 'data/layer-styles';

const CH_CENTRE = {
  lat: 46.801111,
  lng: 8.226667,
};
const MAP_BOUNDS = [
  [45.8057848,5.9211795],
  [47.7983545,10.524451]
]
const CENTER = [CH_CENTRE.lat, CH_CENTRE.lng];

function IndexPage ({ data }) {

  const spots = data.spots
  const protectedAreas = data.protectedAreas
  const obstacles = data.obstacles

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
    center: CENTER,
    bounds: MAP_BOUNDS,
  };
  
  return (
    <Layout pageName="home">
      <Helmet>
        <title>Swiss Paddel Buch</title>
      </Helmet>
      <Container fluid className="g-0">
      <Row className="justify-content-center g-0">
          <Col xl="12" lg="12" md="12" sm="12" xs="12">
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
        </Row>
      
      </Container>
    </Layout>
  );
};

export default IndexPage;


export const pageQuery = graphql`
  query($language: GraphCMS_Locale!) {
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

