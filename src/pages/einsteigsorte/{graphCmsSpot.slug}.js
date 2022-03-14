import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map-Complete";
import { graphql } from "gatsby";
import { Container, Row, Col } from "react-bootstrap";
import { RichText } from '@graphcms/rich-text-react-renderer';
import { Link, Trans, useTranslation } from 'gatsby-plugin-react-i18next';
import SpotIconBlack from "components/SpotIconBlack";

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
    }
  }
`;

export default function SpotDetailsPage({ data: { thisSpot } }) {

  const {t} = useTranslation();

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
          <Col id="map" xl="8" lg="8" md="12" sm="12" xs="12">
            <Map {...mapSettings}>

            </Map>
          </Col>
          <Col className="spot-description" xl="4" lg="4" md="12" sm="12" xs="12">
            
          
            <SpotIconBlack slug={thisSpot.spotType.slug} name={thisSpot.spotType.name}/>
            <div class="spot-title">
              <h1>{thisSpot.name}</h1>
            </div>
            <RichText content={thisSpot.description.raw} />
            <table class="spot-details-table">
              <tr>
                <th><Trans>Potentially Usable By</Trans>:</th>
                <td>
                  <ul>
                    {thisSpot.potentiallyUsableBy
                      .map(paddleCraft => {
                      const { name } = paddleCraft;
                        return (
                          <li>{name}</li>
                        )
                      })
                    }
                  </ul>
                </td>
              </tr>
              <tr>
                <th><Trans>GPS</Trans>:</th>
                  <td>{thisSpot.location.latitude}, {thisSpot.location.longitude}</td>
              </tr>
              <tr>
                <th><Trans>Approx. Address</Trans>:</th>
                <td>{thisSpot.approximateAddress}</td>
              </tr>
              <tr>
                <th><Trans>Waterway</Trans>:</th>
                <td><Link to={`/gewaesser/${thisSpot.waterways.slug}`}>{thisSpot.waterways.name}</Link></td>
              </tr>
              <tr>
                <th><Trans>Data Source</Trans>:</th>
                <td>{thisSpot.dataSourceType.name}</td>
              </tr>
            </table>

          </Col>
        </Row>
      </Container>
    </Layout>
  )
};