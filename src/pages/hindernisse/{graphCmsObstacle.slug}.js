import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map-Complete";
import { graphql } from "gatsby";
import { Container, Row, Col } from "react-bootstrap";
import { RichText } from '@graphcms/rich-text-react-renderer';
import { isDomAvailable } from 'lib/util';
import L from "leaflet";
import { Link, Trans, useTranslation } from 'gatsby-plugin-react-i18next';

export const pageQuery = graphql`
query ObstaclePageQuery($slug: String!, $language: GraphCMS_Locale!) {
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
  thisObstacle: graphCmsObstacle(locale: {eq: $language}, slug: {eq: $slug}) {
    name
    slug
    geometry
    spots {
      slug
      name
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
    }
    obstacleType {
      name
    }
    portageRoute
    portageDistance
    portageDescription {
      raw
    }
    description {
      raw
    }
    waterway {
      slug
      name
    }
  }
}
`;

export default function ObstacleDetailsPage({ data: { thisObstacle, spots, protectedAreas, obstacles } }) {

  const {t} = useTranslation();

  var mapSettings
  var obstacleCentre

  if (isDomAvailable()) {

    const geometryL = L.geoJSON(thisObstacle.geometry)
    const obstacleBounds = geometryL.getBounds()
    obstacleCentre = obstacleBounds.getCenter()
    mapSettings = {
      bounds: obstacleBounds,
    };   
  }

  if ( ! thisObstacle.description ) {
    return(
      <Layout pageName="obstacle-details">
        <Helmet>
          <title>{t(`Paddel Buch - Obstacles`)} - {thisObstacle.name}</title>
        </Helmet>
        <Container fluid >
          <Row className="justify-content-center g-0">
            <Col id="map" xl="8" lg="8" md="12" sm="12" xs="12">
              <Map {...mapSettings}>

              </Map>
            </Col>
            <Col className="obstacle-description" xl="4" lg="4" md="12" sm="12" xs="12">
              <div className="obstacle-title">
                <h1>{thisObstacle.name}</h1>
              </div>
              <table>
                <tr>
                  <th><Trans>Type</Trans>:</th>
                  <td>
                    {thisObstacle.obstacleType.name}
                  </td>
                </tr>
                <tr>
                  <th><Trans>GPS</Trans>:</th>
                  <td>
                    {(!!obstacleCentre) ? obstacleCentre["lat"] : null}, {(!!obstacleCentre) ? obstacleCentre["lng"] : null}
                  </td>
                </tr>
                <tr>
                  <th><Trans>Waterway</Trans>:</th>
                  <td>
                    <Link to={`/gewaesser/${thisObstacle.waterway.slug}`}>{thisObstacle.waterway.name}</Link>
                  </td>
                </tr>
              </table>
            </Col>
          </Row>
        </Container>
      </Layout>
    )
  }
  else {
    return(
      <Layout pageName="obstacle-details">
        <Helmet>
          <title>{t(`Paddel Buch - Obstacles`)} - {thisObstacle.name}</title>
        </Helmet>
        <Container fluid >
          <Row className="justify-content-center g-0">
            <Col id="map" xl="8" lg="8" md="12" sm="12" xs="12">
              <Map {...mapSettings}>
              
              </Map>
            </Col>
            <Col className="obstacle-description" xl="4" lg="4" md="12" sm="12" xs="12">
              <div className="obstacle-title">
                <h1>{thisObstacle.name}</h1>
              </div>
              <RichText content={thisObstacle.description.raw} />
              <table>
                <tr>
                  <th><Trans>Type</Trans>:</th>
                  <td>
                    {thisObstacle.obstacleType.name}
                  </td>
                </tr>
                <tr>
                  <th><Trans>GPS</Trans>:</th>
                  <td>
                    {(!!obstacleCentre) ? obstacleCentre["lat"] : null}, {(!!obstacleCentre) ? obstacleCentre["lng"] : null}
                  </td>
                </tr>
                <tr>
                  <th><Trans>Waterway</Trans>:</th>
                  <td>
                    <Link to={`/gewaesser/${thisObstacle.waterway.slug}`}>{thisObstacle.waterway.name}</Link>
                  </td>
                </tr>
              </table>
              <h2><Trans>Portage Route</Trans></h2>
              <RichText content={thisObstacle.portageDescription.raw} />
              <table>
                <tr>
                  <th><Trans>Distance</Trans>:</th>
                  <td>
                    {thisObstacle.portageDistance}m
                  </td>
                </tr>
                <tr>
                  <th><Trans>Exit Spot</Trans>:</th>
                  <td>
                    <Link to={`/einsteigsorte/${thisObstacle.spots.filter(spot => spot.spotType.slug === "nur-aufsteig")[0].slug}`}>{thisObstacle.spots.filter(spot => spot.spotType.slug === "nur-aufsteig")[0].name}</Link>
                  </td>
                </tr>
                <tr>
                  <th><Trans>Re-entry Spot</Trans>:</th>
                  <td>
                    <Link to={`/einsteigsorte/${thisObstacle.spots.filter(spot => spot.spotType.slug === "nur-einsteig")[0].slug}`}>{thisObstacle.spots.filter(spot => spot.spotType.slug === "nur-einsteig")[0].name}</Link>
                  </td>
                </tr>
              </table>
            </Col>
          </Row>
        </Container>
      </Layout>
    )
  }
};