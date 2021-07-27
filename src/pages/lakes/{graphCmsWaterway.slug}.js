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
      slug
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
  fill: true
}

export default function LakeDetailsPage({ data: { graphCmsWaterway } }) {

  const geometryL = L.geoJSON(graphCmsWaterway.geometry)
  const mapBounds = geometryL.getBounds()
  const mapSettings = {
    bounds: mapBounds
  };

  return(
    
    <Layout pageName="lake-details">
      <Helmet>
        <title>Swiss Paddel Buch - Lakes - {graphCmsWaterway.name}</title>
      </Helmet>
      <Container fluid noGutters>
        <Row noGutters className="justify-content-center">
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

              { graphCmsWaterway.spots.map(spot => {
              const { name, location, description, slug } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker
                  key={slug}
                  position={position}
                >
                  <Popup><b>{name}</b><br />{description.html}</Popup>
                </Marker>
                );
              })}
            </Map>
          </Col>
        </Row>
        <Row noGutters className="justify-content-center">
          <Col>
            <h1>Lake {graphCmsWaterway.name}</h1>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};
//console.log(this.refs.lakeGeoJsonRef.leafletElement.getBounds())

