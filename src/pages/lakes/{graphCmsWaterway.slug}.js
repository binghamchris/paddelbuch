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
      id
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

export default function LakeDetailsPage({ data: { graphCmsWaterway } }) {

  const geometryL = L.geoJSON(graphCmsWaterway.geometry)
  const mapBounds = geometryL.getBounds()
  const mapSettings = {
    bounds: mapBounds
  };

  return(
    
    <Layout pageName="lake-details">
      <Helmet>
        <title>Swiss Canoe Map Prototype - Lake - {graphCmsWaterway.name}</title>
      </Helmet>

      <Container fluid noGutters>
        <Row noGutters className="justify-content-center">
          <Col>
            <h1>Lake {graphCmsWaterway.name}</h1>
          </Col>
        </Row>
        <Row noGutters className="justify-content-center">
          <Col id="map" xl="12" lg="12" md="12" sm="12" xs="12">
            <Map {...mapSettings}>
              <GeoJSON data={graphCmsWaterway.geometry} style={lakeLayerOptions}/>
              
              { graphCmsWaterway.spots.map(spot => {
              const { id, name, location, description } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker
                  key={id}
                  position={position}
                >
                {<Popup><b>{ name }</b>  <br />  { description }</Popup>}
                </Marker>
                );
              })}
            </Map>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};
//console.log(this.refs.lakeGeoJsonRef.leafletElement.getBounds())

