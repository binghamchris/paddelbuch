import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map-Complete";
import { graphql } from "gatsby";
import { Container, Row, Col } from "react-bootstrap";
import L from "leaflet";
import { isDomAvailable } from 'lib/util';
import { useTranslation, Trans } from 'gatsby-plugin-react-i18next';
import EventNoticeList from 'components/EventNotice-List';

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
   thisWaterwayEventNotices: allGraphCmsWaterwayEventNotice(filter: {locale: {eq: $language}, affectedWaterways: {elemMatch: {slug: {eq: $slug}}}}) {
      nodes {
        slug
        updatedAt
        name
        locale
        endDate
      }
    }
  }
`;

export default function LakeDetailsPage({ data: { thisWaterway, thisWaterwayEventNotices  } }) {

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
          <Col id="map" xl="8" lg="7" md="12" sm="12" xs="12">
            <Map {...(!!mapSettings) ? mapSettings : null}>

            </Map>
          </Col>
          <Col className="waterway-details" xl="4" lg="5" md="12" sm="12" xs="12">
            <div className="waterway-title">
              <h1>{thisWaterway.name}</h1>
            </div>
            <h2>
              <Trans>Event Notices</Trans>
            </h2>
            <EventNoticeList thisWaterwayEventNotices={thisWaterwayEventNotices}/>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};