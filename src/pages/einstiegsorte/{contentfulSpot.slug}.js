import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map-Complete";
import { graphql } from "gatsby";
import { Container, Row, Col } from "react-bootstrap";
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import { Link, Trans, I18nextContext, useTranslation } from 'gatsby-plugin-react-i18next';
import SpotIconDarkDetailsPane from "components/SpotIcon-Dark-DetailsPane";
import Clipboard from 'react-clipboard.js';

export const pageQuery = graphql`
  query SpotPageQuery($slug: String!, $language: String!) {
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
    thisSpot: contentfulSpot(node_locale: {eq: $language}, slug: {eq: $slug}) {
      name
      approximateAddress {
        approximateAddress
      }
      paddleCraftType {
        name
        id
      }
      description {
        raw
      }
      location {
        lat
        lon
      }
      spotType {
        name
        slug
      }
      waterway {
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
    center: [thisSpot.location.lat, thisSpot.location.lon],
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
            <div dangerouslySetInnerHTML={{ __html: 
              documentToHtmlString(JSON.parse(thisSpot.description.raw))
            }} />
            <table className="spot-details-table">
              <tbody>
                <tr>
                  <th><Trans>Potentially Usable By</Trans>:</th>
                  <td>
                    <ul>
                      {thisSpot.paddleCraftType
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
                    {thisSpot.location.lat}, {thisSpot.location.lon}
                  </td>
                  <td className="clipboard-cell">
                    <Clipboard button-class="clipboard-btn" button-title={t(`Copy GPS to clipboard`)} data-clipboard-text={`${thisSpot.location.lat}, ${thisSpot.location.lon}`}>
                      <Trans>Copy</Trans>
                    </Clipboard>
                  </td>
                </tr>
                <tr>
                  <th><Trans>Approx. Address</Trans>:</th>
                  <td>
                    {thisSpot.approximateAddress.approximateAddress}
                  </td>
                  <td className="clipboard-cell">
                    <Clipboard button-class="clipboard-btn" button-title={t(`Copy approx. address to clipboard`)} data-clipboard-text={`${thisSpot.approximateAddress.approximateAddress}`}>
                      <Trans>Copy</Trans>
                    </Clipboard>
                  </td>
                </tr>
                <tr>
                  <th><Trans>Waterway</Trans>:</th>
                  <td><Link to={`/gewaesser/${thisSpot.waterway.slug}`}>{thisSpot.waterway.name}</Link></td>
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