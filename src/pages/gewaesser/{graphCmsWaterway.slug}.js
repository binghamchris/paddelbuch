import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map-Complete";
import { graphql } from "gatsby";
import { Container, Row, Col } from "react-bootstrap";
import L from "leaflet";
import { isDomAvailable } from 'lib/util';
import { useTranslation } from 'gatsby-plugin-react-i18next';

export const pageQuery = graphql`
  query LakePageQuery($slug: String!, $language: GraphCMS_Locale!) {
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
    thisWaterway: graphCmsWaterway(locale: {eq: $language}, slug: {eq: $slug}) {
      name
      geometry
    }
  }
`;

export default function LakeDetailsPage({ data: { thisWaterway, spots, protectedAreas, obstacles  } }) {

  const {t} = useTranslation();
  
  var mapSettings

  if (isDomAvailable()) {

    const geometryL = L.geoJSON(thisWaterway.geometry)
    const mapBounds = geometryL.getBounds()
    mapSettings = {
      bounds: mapBounds
    };
  } 

  return(
    
    <Layout pageName="waterway-details">
      <Helmet>
        <title>{t(`Paddel Buch - Waterways`)} - {thisWaterway.name}</title>
      </Helmet>
      <Container fluid >
        <Row className="justify-content-center g-0">
          <Col id="map" xl="12" lg="12" md="12" sm="12" xs="12">
            <Map {...(!!mapSettings) ? mapSettings : null}>

            </Map>
          </Col>
        </Row>
        <Row className="justify-content-center g-0 waterway-description waterway-title">
          <Col>
            <h1>{thisWaterway.name}</h1>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};