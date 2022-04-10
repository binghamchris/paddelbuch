import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map-Complete";
import { graphql } from "gatsby";
import { Container, Row, Col } from "react-bootstrap";
import { RichText } from '@graphcms/rich-text-react-renderer';
import { Link, Trans, I18nextContext, useTranslation } from 'gatsby-plugin-react-i18next';
import SpotIconDarkDetailsPane from "components/SpotIcon-Dark-DetailsPane";
import Clipboard from 'react-clipboard.js';

export const pageQuery = graphql`
  query SpotPageQuery($slug: String!, $language: GraphCMS_Locale!) {
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
    thisSpot: graphCmsSpot(locale: {eq: $language}, slug: {eq: $slug}) {
      name
      approximateAddress
      potentiallyUsableBy {
        name
        id
      }
      description {
        raw
      }
      location {
        latitude
        longitude
      }
      spotType {
        name
        slug
      }
      waterways {
        name
        slug
      }
      dataSourceType {
        name
      }
      slug
      updatedAt 
    }
  }
`;

export default function SpotDetailsPage({ data: { thisSpot } }) {

  const {t} = useTranslation();
  const context = React.useContext(I18nextContext);
  const language = context.language

  var lastUpdateDtFormat = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
  var lastUpdateDtRaw = new Date(thisSpot.updatedAt)
  var lastUpdateDt

  if ( language === "en" ) {
    lastUpdateDt = new Intl.DateTimeFormat('en-UK', lastUpdateDtFormat).format(lastUpdateDtRaw)
  }
  if ( language === "de" ) {
    lastUpdateDt = new Intl.DateTimeFormat('de-DE', lastUpdateDtFormat).format(lastUpdateDtRaw)
  }

  const mapSettings = {
    center: [thisSpot.location.latitude, thisSpot.location.longitude],
    zoom: 16,
  };

  return(
    <Layout pageName="spot-details">
      <Helmet>
        <title>{t(`Paddel Buch - Spots`)} - {thisSpot.name}</title>
      </Helmet>
      <Container fluid >
        <Row className="justify-content-center g-0">
          <Col id="map" xl="8" lg="7" md="12" sm="12" xs="12">
            <Map {...mapSettings}>

            </Map>
          </Col>
          <Col className="spot-description" xl="4" lg="5" md="12" sm="12" xs="12">
            <SpotIconDarkDetailsPane slug={thisSpot.spotType.slug} name={thisSpot.spotType.name}/>
            <div className="spot-title">
              <h1>{thisSpot.name}</h1>
            </div>
            <RichText content={thisSpot.description.raw} />
            <table className="spot-details-table">
              <tbody>
                <tr>
                  <th><Trans>Potentially Usable By</Trans>:</th>
                  <td>
                    <ul>
                      {thisSpot.potentiallyUsableBy
                        .map(paddleCraft => {
                        const { name, id } = paddleCraft;
                          return (
                            <li key={id}>{name}</li>
                          )
                        })
                      }
                    </ul>
                  </td>
                </tr>
                <tr>
                  <th><Trans>GPS</Trans>:</th>
                    <td>
                      {thisSpot.location.latitude}, {thisSpot.location.longitude}
                    </td>
                    <td className="clipboard-cell">
                      <Clipboard button-class="clipboard-btn" button-title={t(`Copy GPS to clipboard`)} data-clipboard-text={`${thisSpot.location.latitude}, ${thisSpot.location.longitude}`}>
                        <Trans>Copy</Trans>
                      </Clipboard>
                    </td>
                </tr>
                <tr>
                  <th><Trans>Approx. Address</Trans>:</th>
                  <td>
                    {thisSpot.approximateAddress}
                  </td>
                  <td className="clipboard-cell">
                    <Clipboard button-class="clipboard-btn" button-title={t(`Copy approx. address to clipboard`)} data-clipboard-text={`${thisSpot.approximateAddress}`}>
                      <Trans>Copy</Trans>
                    </Clipboard>
                  </td>
                </tr>
                <tr>
                  <th><Trans>Waterway</Trans>:</th>
                  <td><Link to={`/gewaesser/${thisSpot.waterways.slug}`}>{thisSpot.waterways.name}</Link></td>
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
};