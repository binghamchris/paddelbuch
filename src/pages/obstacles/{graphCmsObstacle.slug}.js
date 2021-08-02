import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql, Link } from "gatsby";
import { Marker, Popup, GeoJSON } from "react-leaflet";
import { Container, Row, Col } from "react-bootstrap";
import * as layerStyle from '../../hooks/useLayerStyles';
import { RichText } from '@graphcms/rich-text-react-renderer';
import { isDomAvailable } from 'lib/util';
import L from "leaflet";
import  { markerStyles } from 'lib/marker-styles';

export const pageQuery = graphql`
query ObstaclePageQuery($slug: String!) {
  graphCmsObstacle(locale: {eq: en}, slug: {eq: $slug}) {
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
      protectedAreas {
        name
        slug
        geometry
        description {
          raw
        }
        protectedAreaType {
          name
        }
      }
      slug
      name
    }
  }
}
`;

export default function ObstacleDetailsPage({ data: { graphCmsObstacle } }) {
  var spotEinsteigAufsteigIcon
  var spotNurEinsteigIcon
  var spotNurAufsteigIcon
  var spotRaststatteIcon
  var mapSettings
  var obstacleCentre

  if (isDomAvailable()) {
    spotEinsteigAufsteigIcon = new L.icon(markerStyles.spotEinsteigAufsteigIcon)
    spotNurEinsteigIcon = new L.icon(markerStyles.spotNurEinsteigIcon)
    spotNurAufsteigIcon = new L.icon(markerStyles.spotNurAufsteigIcon)
    spotRaststatteIcon = new L.icon(markerStyles.spotRaststatteIcon)

    const geometryL = L.geoJSON(graphCmsObstacle.geometry)
    const obstacleBounds = geometryL.getBounds()
    obstacleCentre = obstacleBounds.getCenter()
    mapSettings = {
      bounds: obstacleBounds,
    };   
  }

  if ( ! graphCmsObstacle.description ) {
    return(
      <Layout pageName="obstacle-details">
        <Helmet>
          <title>Swiss Paddel Buch - Obstacles - {graphCmsObstacle.name}</title>
        </Helmet>
        <Container fluid >
          <Row className="justify-content-center g-0">
            <Col id="map" xl="12" lg="12" md="12" sm="12" xs="12">
              <Map {...mapSettings}>
                <GeoJSON data={graphCmsObstacle.geometry} style={layerStyle.obstacleStyle}>
                  <Popup>
                    <b>{graphCmsObstacle.name}</b>
                    <br />{graphCmsObstacle.obstacleType.name}
                  </Popup>
                </GeoJSON>

                { graphCmsObstacle.waterway.protectedAreas.map(protectedArea => {
                  const { name, geometry, protectedAreaType, slug } = protectedArea;
                  return (
                    <GeoJSON key={slug} data={geometry} style={layerStyle.protectedAreaStyle}>
                      <Popup><b>{name}</b><br />{protectedAreaType.name}</Popup>
                    </GeoJSON>
                  )
                
                })}
            </Map>
            </Col>
          </Row>
          <Row className="justify-content-center g-0 obstacle-description obstacle-title">
            <Col>
              <h1>{graphCmsObstacle.name}</h1>
            </Col>
          </Row>
          <Row className="justify-content-center g-0 obstacle-description">
            <Col xl="12" lg="12" md="12" sm="12" xs="12">
              <h2>Obstacle Details</h2>
              <p><b>Type:</b> {graphCmsObstacle.obstacleType.name}</p>
              <p><b>GPS:</b> {(!!obstacleCentre) ? obstacleCentre["lat"] : null}, {(!!obstacleCentre) ? obstacleCentre["lng"] : null}</p>
              <p><b>Waterway:</b> <Link to={`/waterways/${graphCmsObstacle.waterway.slug}`}>{graphCmsObstacle.waterway.name}</Link></p>
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
          <title>Swiss Paddel Buch - Obstacles - {graphCmsObstacle.name}</title>
        </Helmet>
        <Container fluid >
          <Row className="justify-content-center g-0">
            <Col id="map" xl="12" lg="12" md="12" sm="12" xs="12">
              <Map {...mapSettings}>
                <GeoJSON data={graphCmsObstacle.geometry} style={layerStyle.obstacleStyle}>
                  <Popup>
                    <b>{graphCmsObstacle.name}</b>
                    <br />{graphCmsObstacle.obstacleType.name}
                  </Popup>
                </GeoJSON>
                <GeoJSON data={graphCmsObstacle.portageRoute} style={layerStyle.portageStyle}>
                  <Popup><b>Portage route for {graphCmsObstacle.name}</b></Popup>
                </GeoJSON>

                { graphCmsObstacle.waterway.protectedAreas.map(protectedArea => {
                  const { name, geometry, protectedAreaType, slug } = protectedArea;
                  return (
                    <GeoJSON key={slug} data={geometry} style={layerStyle.protectedAreaStyle}>
                      <Popup><b>{name}</b><br />{protectedAreaType.name}</Popup>
                    </GeoJSON>
                  )
                
                })}

                { graphCmsObstacle.spots
                .filter(spot => spot.spotType.slug === "einsteig-aufsteig")
                .map(spot => {
                const { name, location, description, slug } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotEinsteigAufsteigIcon) ? spotEinsteigAufsteigIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><Link to={`/spots/${slug}`}>More details</Link></p>
                    </Popup>}
                  </Marker>
                  );
                })}
                { graphCmsObstacle.spots
                .filter(spot => spot.spotType.slug === "nur-einsteig")
                .map(spot => {
                const { name, location, description, slug } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurEinsteigIcon) ? spotNurEinsteigIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><Link to={`/spots/${slug}`}>More details</Link></p>
                    </Popup>}
                  </Marker>
                  );
                })}
                { graphCmsObstacle.spots
                .filter(spot => spot.spotType.slug === "nur-aufsteig")
                .map(spot => {
                const { name, location, description, slug } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurAufsteigIcon) ? spotNurAufsteigIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><Link to={`/spots/${slug}`}>More details</Link></p>
                    </Popup>}
                  </Marker>
                  );
                })}
                { graphCmsObstacle.spots
                .filter(spot => spot.spotType.slug === "raststatte")
                .map(spot => {
                const { name, location, description, slug } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotRaststatteIcon) ? spotRaststatteIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><Link to={`/spots/${slug}`}>More details</Link></p>
                    </Popup>}
                  </Marker>
                  );
                })}
              </Map>
            </Col>
          </Row>
          <Row className="justify-content-center g-0 obstacle-description obstacle-title">
            <Col>
              <h1>{graphCmsObstacle.name}</h1>
            </Col>
          </Row>
          <Row className="justify-content-center g-0 obstacle-description">
            <Col xl="6" lg="6" md="12" sm="12" xs="12">
              <h2>Obstacle Details</h2>
              <RichText content={graphCmsObstacle.description.raw} />
              <p><b>Type:</b> {graphCmsObstacle.obstacleType.name}</p>
              <p><b>GPS:</b> {(!!obstacleCentre) ? obstacleCentre["lat"] : null}, {(!!obstacleCentre) ? obstacleCentre["lng"] : null}</p>
              <p><b>Waterway:</b> <Link to={`/waterways/${graphCmsObstacle.waterway.slug}`}>{graphCmsObstacle.waterway.name}</Link></p>
            </Col>
            <Col xl="6" lg="6" md="12" sm="12" xs="12">
              <h2>Portage Route</h2>
              <RichText content={graphCmsObstacle.portageDescription.raw} />
              <p><b>Distance:</b> {graphCmsObstacle.portageDistance}m</p>
              <p><b>Exit Spot:</b> <Link to={`/spots/${graphCmsObstacle.spots.filter(spot => spot.spotType.slug === "nur-aufsteig")[0].slug}`}>{graphCmsObstacle.spots.filter(spot => spot.spotType.slug === "nur-aufsteig")[0].name}</Link></p>
              <p><b>Re-entry Spot:</b> <Link to={`/spots/${graphCmsObstacle.spots.filter(spot => spot.spotType.slug === "nur-einsteig")[0].slug}`}>{graphCmsObstacle.spots.filter(spot => spot.spotType.slug === "nur-einsteig")[0].name}</Link></p>
              
            </Col>
          </Row>
        </Container>
      </Layout>
    )
  }
};