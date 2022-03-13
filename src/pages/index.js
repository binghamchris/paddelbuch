import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map-Complete";
import { graphql } from "gatsby"
import { Container, Row, Col } from "react-bootstrap";


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

  const mapSettings = {
    center: CENTER,
    bounds: MAP_BOUNDS,
  };
  
  return (
    <Layout pageName="home">
      <Helmet>
        <title>Paddel Buch</title>
      </Helmet>
      <Container fluid className="g-0">
      <Row className="justify-content-center g-0">
          <Col xl="12" lg="12" md="12" sm="12" xs="12">
            <Map {...mapSettings}>

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
  }
`;

