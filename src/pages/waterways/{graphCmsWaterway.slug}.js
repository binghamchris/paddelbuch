import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql } from "gatsby";
import { Marker, Popup, GeoJSON } from "react-leaflet";
import { Container, Row, Col } from "react-bootstrap";
import L from "leaflet";

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

const lakeLayerOptions = {
  color: '#3b89a5',
  weight: 2,
  fill: false
}

const protectedAreaLayerOptions = {
  color: '#f2c136',
  weight: 2,
  fill: true,
  fillOpacity: 0.5,
}

const obstacleLayerOptions = {
  color: '#AE3450',
  weight: 2,
  fill: true,
  fillOpacity: 1,
}

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
              <GeoJSON data={graphCmsWaterway.geometry} style={lakeLayerOptions}/>

              { graphCmsWaterway.protectedAreas.map(protectedArea => {
                const { name, geometry, slug, protectedAreaType, isAreaMarked } = protectedArea;
                return (
                  <GeoJSON data={geometry} style={protectedAreaLayerOptions}>
                    <Popup><b>{name}</b><br />{protectedAreaType.name}<br/>{isAreaMarked}</Popup>
                  </GeoJSON>
                )
              
              })}

              { graphCmsWaterway.obstacles.map(obstacle => {
                const { name, geometry, slug, obstacleType, portageRoute, isPortageNecessary, isPortagePossible } = obstacle;
                return (
                  <GeoJSON data={geometry} style={obstacleLayerOptions}>
                    <Popup><b>{name}</b><br />{obstacleType.name}<br/>{isPortageNecessary}</Popup>
                  </GeoJSON>
                  
                )
              
              })}

              { graphCmsWaterway.spots.map(spot => {
              const { name, location, description, slug } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker key={slug} position={position}>
                  {<Popup><b>{name}</b><br />{description.html}</Popup>}
                </Marker>
                );
              })}
            </Map>
          </Col>
        </Row>
        <Row id="waterway-description" className="justify-content-center g-0">
          <Col>
            <h1>{graphCmsWaterway.name}</h1>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};
//console.log(this.refs.lakeGeoJsonRef.leafletElement.getBounds())

