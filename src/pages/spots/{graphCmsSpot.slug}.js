import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql, Link } from "gatsby";
import { Marker, Popup, GeoJSON } from "react-leaflet";
import { Container, Row, Col } from "react-bootstrap";
import * as markerStyle from '../../hooks/useMarkerStyles';
import * as layerStyle from '../../hooks/useLayerStyles';

export const pageQuery = graphql`
  query SpotPageQuery($slug: String!) {
    graphCmsSpot(locale: {eq: en}, slug: {eq: $slug}) {
      name
      approximateAddress
      description {
        html
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
            html
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
            html
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

  const mapSettings = {
    center: [graphCmsSpot.location.latitude, graphCmsSpot.location.longitude],
    zoom: 16,
  };

  return(
    
    <Layout pageName="spot-details">
      <Helmet>
        <title>Swiss Paddel Buch - Spots - {graphCmsSpot.name}</title>
      </Helmet>
      <Container fluid >
        <Row className="justify-content-center g-0">
          <Col id="map" xl="12" lg="12" md="12" sm="12" xs="12">
            <Map {...mapSettings}>

              { graphCmsSpot.waterways.protectedAreas.map(protectedArea => {
                const { name, geometry, slug, protectedAreaType, isAreaMarked } = protectedArea;
                return (
                  <GeoJSON data={geometry} style={layerStyle.protectedAreaStyle}>
                    <Popup><b>{name}</b><br />{protectedAreaType.name}<br/>{isAreaMarked}</Popup>
                  </GeoJSON>
                )
              
              })}

              { graphCmsSpot.waterways.obstacles.map(obstacle => {
                const { name, geometry, slug, obstacleType, portageRoute, isPortageNecessary, isPortagePossible } = obstacle;
                return (
                  <GeoJSON data={geometry} style={layerStyle.obstacleStyle}>
                    <Popup><b>{name}</b><br />{obstacleType.name}<br/>{isPortageNecessary}</Popup>
                  </GeoJSON>
                  
                )
              
              })}

              { graphCmsSpot.waterways.spots
              .filter(spot => spot.spotType.slug === "einsteig-aufsteig")
              .map(spot => {
              const { name, location, description, slug } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker key={slug} position={position} icon={markerStyle.spotEinsteigAufsteigIcon}>
                  {<Popup>
                    <b>{name}</b>
                    <p>{description.html}</p>
                    <p><Link to={`/spots/${slug}`}>More details</Link></p>
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
                <Marker key={slug} position={position} icon={markerStyle.spotNurEinsteigIcon}>
                  {<Popup>
                    <b>{name}</b>
                    <p>{description.html}</p>
                    <p><Link to={`/spots/${slug}`}>More details</Link></p>
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
                <Marker key={slug} position={position} icon={markerStyle.spotNurAufsteigIcon}>
                  {<Popup>
                    <b>{name}</b>
                    <p>{description.html}</p>
                    <p><Link to={`/spots/${slug}`}>More details</Link></p>
                  </Popup>}
                </Marker>
                );
              })}
              { graphCmsSpot.waterways.spots
              .filter(spot => spot.spotType.slug === "raststatte")
              .map(spot => {
              const { name, location, description, slug } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker key={slug} position={position} icon={markerStyle.spotRaststatteIcon}>
                  {<Popup>
                    <b>{name}</b>
                    <p>{description.html}</p>
                    <p><Link to={`/spots/${slug}`}>More details</Link></p>
                  </Popup>}
                </Marker>
                );
              })}
            </Map>
          </Col>
        </Row>
        <Row className="justify-content-center g-0 spot-description">
          <Col>
            <h1>{graphCmsSpot.name}</h1>
          </Col>
        </Row>
        <Row className="justify-content-center g-0 spot-description">
          <Col xl="12" lg="12" md="12" sm="12" xs="12">
            <h2>Spot Details</h2>
            <p>{graphCmsSpot.description.html}</p>
            <p><b>Type:</b> {graphCmsSpot.spotType.name}</p>
            <p><b>GPS:</b> {graphCmsSpot.location.latitude}, {graphCmsSpot.location.longitude}</p>
            <p><b>Approx. Address:</b> {graphCmsSpot.approximateAddress}</p>
            <p><b>Waterway:</b> <Link to={`/waterways/${graphCmsSpot.waterways.slug}`}>{graphCmsSpot.waterways.name}</Link></p>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};