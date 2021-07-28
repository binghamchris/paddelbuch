import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql, Link } from "gatsby";
import { Marker, Popup, GeoJSON } from "react-leaflet";
import { Container, Row, Col } from "react-bootstrap";
import L from "leaflet";
import * as markerStyle from '../../hooks/useMarkerStyles';
import * as layerStyle from '../../hooks/useLayerStyles';

export const pageQuery = graphql`
  query LakePageQuery($slug: String!) {
    graphCmsWaterway(locale: {eq: en}, slug: {eq: $slug}) {
      name
      geometry
      spots {
        name
        description {
          html
        }
        location {
          latitude
          longitude
        }
        spotType {
          slug
        }
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
      tours {
        name
        slug
        geometry
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
    }
  }
`;

export default function LakeDetailsPage({ data: { graphCmsWaterway } }) {

  const geometryL = L.geoJSON(graphCmsWaterway.geometry)
  const mapBounds = geometryL.getBounds()
  const mapSettings = {
    bounds: mapBounds
  };

  return(
    
    <Layout pageName="waterway-details">
      <Helmet>
        <title>Swiss Paddel Buch - Lakes - {graphCmsWaterway.name}</title>
      </Helmet>
      <Container fluid >
        <Row className="justify-content-center g-0">
          <Col id="map" xl="12" lg="12" md="12" sm="12" xs="12">
            <Map {...mapSettings}>
              <GeoJSON data={graphCmsWaterway.geometry} style={layerStyle.lakeStyle}/>

              { graphCmsWaterway.protectedAreas.map(protectedArea => {
                const { name, geometry, slug, protectedAreaType, isAreaMarked } = protectedArea;
                return (
                  <GeoJSON data={geometry} style={layerStyle.protectedAreaStyle}>
                    <Popup><b>{name}</b><br />{protectedAreaType.name}<br/>{isAreaMarked}</Popup>
                  </GeoJSON>
                )
              
              })}

              { graphCmsWaterway.obstacles.map(obstacle => {
                const { name, geometry, slug, obstacleType, portageRoute, isPortageNecessary, isPortagePossible } = obstacle;
                return (
                  <GeoJSON data={geometry} style={layerStyle.obstacleStyle}>
                    <Popup><b>{name}</b><br />{obstacleType.name}<br/>{isPortageNecessary}</Popup>
                  </GeoJSON>
                  
                )
              
              })}

              { graphCmsWaterway.spots
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
              { graphCmsWaterway.spots
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
              { graphCmsWaterway.spots
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
              { graphCmsWaterway.spots
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
        <Row className="justify-content-center g-0 waterway-description">
          <Col>
            <h1>{graphCmsWaterway.name}</h1>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};