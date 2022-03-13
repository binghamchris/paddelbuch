import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map-Complete";
import { graphql } from "gatsby";
import { Container, Row, Col } from "react-bootstrap";
import { RichText } from '@graphcms/rich-text-react-renderer';
import { Link, Trans, useTranslation } from 'gatsby-plugin-react-i18next';

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
            <div className="spot-title">
              <h1>{thisSpot.name}</h1>
            </div>
            <RichText content={thisSpot.description.raw} />
            <p><b><Trans>Type</Trans>:</b> {thisSpot.spotType.name}</p>
            <p><b><Trans>GPS</Trans>:</b> {thisSpot.location.latitude}, {thisSpot.location.longitude}</p>
            <p><b><Trans>Approx. Address</Trans>:</b> {thisSpot.approximateAddress}</p>
            <p><b><Trans>Potentially Usable By</Trans>:</b>
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
            </p>
            <p><b><Trans>Waterway</Trans>:</b> <Link to={`/gewaesser/${thisSpot.waterways.slug}`}>{thisSpot.waterways.name}</Link></p>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};