import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map-Complete";
import { graphql } from "gatsby";
import { Container, Row, Col } from "react-bootstrap";
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import { isDomAvailable } from 'lib/util';
import L from "leaflet";
import { Link, Trans, I18nextContext, useTranslation } from '@herob191/gatsby-plugin-react-i18next';

export const pageQuery = graphql`
query ObstaclePageQuery($slug: String!, $language: String!) {
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
  thisObstacle: contentfulObstacle(node_locale: {eq: $language}, slug: {eq: $slug}) {
    name
    slug
    geometry {
      internal {
        content
      }
    }
    spot {
      slug
      name
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
    }
    obstacleType {
      name
    }
    portageRoute {
      internal {
        content
      }
    }
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
    updatedAt
  }
}
`;

export default function ObstacleDetailsPage({ data: { thisObstacle, spot, protectedAreas, obstacles } }) {

  const {t} = useTranslation();
  const context = React.useContext(I18nextContext);
  const language = context.language

  var lastUpdateDtFormat = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
  var lastUpdateDtRaw = new Date(thisObstacle.updatedAt)
  var lastUpdateDt

  if ( language === "en" ) {
    lastUpdateDt = new Intl.DateTimeFormat('en-UK', lastUpdateDtFormat).format(lastUpdateDtRaw)
  }
  if ( language === "de" ) {
    lastUpdateDt = new Intl.DateTimeFormat('de-DE', lastUpdateDtFormat).format(lastUpdateDtRaw)
  }
  
  var mapSettings
  var obstacleCentre

  if (isDomAvailable()) {

    const geometryL = L.geoJSON(JSON.parse(thisObstacle.geometry.internal.content))
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
        <Container fluid className="g-0">
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
                <tbody>
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
  else {
    return(
      <Layout pageName="obstacle-details">
        <Helmet>
          <title>{t(`Paddel Buch - Obstacles`)} - {thisObstacle.name}</title>
        </Helmet>
        <Container fluid className="g-0">
          <Row className="justify-content-center g-0">
            <Col id="map" xl="8" lg="8" md="12" sm="12" xs="12">
              <Map {...mapSettings}>
              
              </Map>
            </Col>
            <Col className="obstacle-description" xl="4" lg="4" md="12" sm="12" xs="12">
              <div className="obstacle-title">
                <h1>{thisObstacle.name}</h1>
              </div>
              <div dangerouslySetInnerHTML={{ __html: 
                documentToHtmlString(JSON.parse(thisObstacle.description.raw))
              }} />
              <table>
                <tbody>
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
                  <tr>
                    <th><Trans>Last Updated</Trans>:</th>
                    <td>
                      {lastUpdateDt}
                    </td>
                  </tr>
                  </tbody>
              </table>
              <h2><Trans>Portage Route</Trans></h2>
              <div dangerouslySetInnerHTML={{ __html: 
                documentToHtmlString(JSON.parse(thisObstacle.portageDescription.raw))
              }} />
              <table>
                <tbody>
                  <tr>
                    <th><Trans>Distance</Trans>:</th>
                    <td>
                      {thisObstacle.portageDistance}m
                    </td>
                  </tr>
                  <tr>
                    <th><Trans>Exit Spot</Trans>:</th>
                    <td>
                      <Link to={`/einstiegsorte/${thisObstacle.spot.filter(spot => spot.spotType.slug === "nur-ausstieg")[0].slug}`}>{thisObstacle.spot.filter(spot => spot.spotType.slug === "nur-ausstieg")[0].name}</Link>
                    </td>
                  </tr>
                  <tr>
                    <th><Trans>Re-entry Spot</Trans>:</th>
                    <td>
                      <Link to={`/einstiegsorte/${thisObstacle.spot.filter(spot => spot.spotType.slug === "nur-einstieg")[0].slug}`}>{thisObstacle.spot.filter(spot => spot.spotType.slug === "nur-einstieg")[0].name}</Link>
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
};