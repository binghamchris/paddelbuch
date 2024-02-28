import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map-Complete";
import { graphql } from "gatsby";
import { Container, Row, Col } from "react-bootstrap";
<<<<<<< Updated upstream:src/pages/gewaesserereignisse/{graphCmsWaterwayEventNotice.slug}.js
import { RichText } from '@graphcms/rich-text-react-renderer';
import { Trans, I18nextContext, useTranslation } from 'gatsby-plugin-react-i18next';
=======
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import { Trans, I18nextContext, useTranslation } from '@herob/gatsby-plugin-react-i18next';
>>>>>>> Stashed changes:src/pages/gewaesserereignisse/{contentfulWaterwayEventNotice.slug}.js
import { isDomAvailable } from 'lib/util';
import L from "leaflet";

export const pageQuery = graphql`
  query WaterwayEventNoticePageQuery($slug: String!, $language: GraphCMS_Locale!) {
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
    thisNotice: graphCmsWaterwayEventNotice(locale: {eq: $language}, slug: {eq: $slug}) {
      slug
      updatedAt
      name
      location {
        latitude
        longitude
      }
      affectedArea
      affectedSpots {
        name
        slug
      }
      affectedWaterways {
        name
        slug
      }
      description {
        raw
      }
      endDate
      startDate
    }
  }
`;

export default function WaterwayEventNoticeDetailsPage({ data: { thisNotice } }) {
  const {t} = useTranslation();
  const context = React.useContext(I18nextContext);
  const language = context.language

  var lastUpdateDtFormat = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
  var lastUpdateDtRaw = new Date(thisNotice.updatedAt)
  var lastUpdateDt

  if ( language === "en" ) {
    lastUpdateDt = new Intl.DateTimeFormat('en-UK', lastUpdateDtFormat).format(lastUpdateDtRaw)
  }
  if ( language === "de" ) {
    lastUpdateDt = new Intl.DateTimeFormat('de-DE', lastUpdateDtFormat).format(lastUpdateDtRaw)
  }

  var mapSettings

  if (isDomAvailable()) {
    const geometryL = L.geoJSON(thisNotice.affectedArea)
    const affectedAreaBounds = geometryL.getBounds()
    mapSettings = {
      bounds: affectedAreaBounds,
    };   
  }

  return(
    <Layout pageName="notice-details">
      <Helmet>
        <title>{t(`Paddel Buch - Notices`)} - {thisNotice.name}</title>
      </Helmet>
      <Container fluid >
        <Row className="justify-content-center g-0">
          <Col id="map" xl="8" lg="7" md="12" sm="12" xs="12">
            <Map {...mapSettings}>

            </Map>
          </Col>
          <Col className="notice-description" xl="4" lg="5" md="12" sm="12" xs="12">
            <div className="notice-title">
              <h1>{thisNotice.name}</h1>
            </div>
            <RichText content={thisNotice.description.raw} />
            <table className="notice-details-table">
              <tbody>
                <tr>
                  <th><Trans>Approx. Start Date</Trans>:</th>
                  <td>
                    {thisNotice.startDate}
                  </td>
                </tr>
                <tr>
                  <th><Trans>Approx. End Date</Trans>:</th>
                  <td>
                    {thisNotice.endDate}
                  </td>
                </tr>
                <tr>
                  <th><Trans>Last Updated</Trans>:</th>
                  <td>
                    {lastUpdateDt}
                  </td>
                </tr>
              </tbody>
            </table>

          </Col>
        </Row>
      </Container>
    </Layout>
  )
}