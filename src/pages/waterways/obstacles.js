import React from "react";
import { Helmet } from "react-helmet";
import { Popup, GeoJSON } from "react-leaflet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql, useStaticQuery } from "gatsby"
import { Container, Row, Col } from "react-bootstrap";
//import * as markerStyle from '../../hooks/useMarkerStyles';
import { isDomAvailable } from 'lib/util';
import L from "leaflet";

const CH_CENTRE = {
  lat: 46.801111,
  lng: 8.226667,
};
const MAP_BOUNDS = [
  [45.8057848,5.9211795],
  [47.7983545,10.524451]
]
const CENTER = [CH_CENTRE.lat, CH_CENTRE.lng];

function IndexPage () {

  const { obstacles } = useStaticQuery(graphql`
    query {
      obstacles: allGraphCmsObstacle(filter: {locale: {eq: en}}) {
        nodes {
          name
          geometry
          slug
        }
      }
    }
  `)

  var obstacleIcon

  if (isDomAvailable()) {
    obstacleIcon = new L.icon({
      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",  
      shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      iconSize: [25, 41],
    })
  }

  const mapSettings = {
    center: CENTER,
    bounds: MAP_BOUNDS,
  };
  
  return (
    <Layout pageName="home">
      <Helmet>
        <title>Swiss Paddel Buch</title>
      </Helmet>
      <Container fluid className="g-0">
        <Row className="justify-content-center g-0">
          <Col id="map" xl="9" lg="9" md="12" sm="12" xs="12">
            <Map {...mapSettings}>
            { obstacles.nodes
              //.filter(obstacle => obstacle.geometry.type === "Point")
              .map(obstacle => {
                const { name, geometry, slug } = obstacle;
                return (
                  <GeoJSON data={geometry} style={(!!obstacleIcon) ? obstacleIcon : null}>
                    <Popup><b>{name}</b><br />{slug}</Popup>
                  </GeoJSON>
                );
            })}
            </Map>
          </Col>
          <Col xl="3" lg="3" md="12" sm="12" xs="12">
            <div class="info-pane">
              <div id="welcome-message">
                <p>Please click a spot for information</p>
              </div>
              <div id="spot-details" hidden="true">
                <h1 id="spot-name"> </h1>
                <span id="spot-desc"></span>
                <h2>Waterway</h2>
                <span id="spot-waterway"></span>
              </div>
            </div>
          </Col>
        </Row>
      
      </Container>
    </Layout>
  );
};

export default IndexPage;
