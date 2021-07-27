import React from "react";
import { Helmet } from "react-helmet";
import { Marker } from "react-leaflet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql, useStaticQuery } from "gatsby"
import { Container, Row, Col } from "react-bootstrap";
import * as markerStyle from '../hooks/useMarkerStyles';
//import { icon } from "leaflet";
//import L from "leaflet";

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

  const { spots } = useStaticQuery(graphql`
    query {
      spots: allGraphCmsSpot(filter: {locale: {eq: en}}) {
        nodes {
          name
          description {
            html
          }
          location {
            latitude
            longitude
          }
          waterways {
            name
            slug
            paddlingEnvironments {
              slug
            }
          }
          spotType {
            slug
          }
          slug
        }
      }
    }
  `)

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
            { spots.nodes
              .filter(spot => spot.spotType.slug === "einsteig-aufsteig")
              .map(spot => {
                const { name, location, description, waterways, slug } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker
                    key={slug}
                    position={position}
                    icon={markerStyle.spotEinsteigAufsteigIcon}
                    eventHandlers={{
                      click: () => {
                        document.getElementById('welcome-message').hidden = true;
                        document.getElementById('spot-details').hidden = false;
                        document.getElementById('spot-name').textContent = name;
                        document.getElementById('spot-desc').innerHTML = description.html;
                        document.getElementById('spot-waterway').innerHTML = `<a href="./waterways/${waterways.slug}">${waterways.name}</a>`;

                        if (description.html !== "<p>None</p>") {
                          document.getElementById('spot-desc').innerHTML = description.html;
                        } else {
                          document.getElementById('spot-desc').innerHTML = "";
                        }
                      },
                      
                    }}
                  >
                  </Marker>
                );
            })}
            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-einsteig")
              .map(spot => {
                const { name, location, description, waterways, slug } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker
                    key={slug}
                    position={position}
                    icon={markerStyle.spotNurEinsteigIcon}
                    eventHandlers={{
                      click: () => {
                        document.getElementById('welcome-message').hidden = true;
                        document.getElementById('spot-details').hidden = false;
                        document.getElementById('spot-name').textContent = name;
                        document.getElementById('spot-desc').innerHTML = description.html;
                        document.getElementById('spot-waterway').innerHTML = `<a href="./waterways/${waterways.slug}">${waterways.name}</a>`;

                        if (description.html !== "<p>None</p>") {
                          document.getElementById('spot-desc').innerHTML = description.html;
                        } else {
                          document.getElementById('spot-desc').innerHTML = "";
                        }
                      },
                      
                    }}
                  >
                  </Marker>
                );
            })}
            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-aufsteig")
              .map(spot => {
                const { name, location, description, waterways, slug } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker
                    key={slug}
                    position={position}
                    icon={markerStyle.spotNurAufsteigIcon}
                    eventHandlers={{
                      click: () => {
                        document.getElementById('welcome-message').hidden = true;
                        document.getElementById('spot-details').hidden = false;
                        document.getElementById('spot-name').textContent = name;
                        document.getElementById('spot-desc').innerHTML = description.html;
                        document.getElementById('spot-waterway').innerHTML = `<a href="./waterways/${waterways.slug}">${waterways.name}</a>`;

                        if (description.html !== "<p>None</p>") {
                          document.getElementById('spot-desc').innerHTML = description.html;
                        } else {
                          document.getElementById('spot-desc').innerHTML = "";
                        }
                      },
                      
                    }}
                  >
                  </Marker>
                );
            })}
            { spots.nodes
              .filter(spot => spot.spotType.slug === "raststatte")
              .map(spot => {
                const { name, location, description, waterways, slug } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker
                    key={slug}
                    position={position}
                    icon={markerStyle.spotRaststatteIcon}
                    eventHandlers={{
                      click: () => {
                        document.getElementById('welcome-message').hidden = true;
                        document.getElementById('spot-details').hidden = false;
                        document.getElementById('spot-name').textContent = name;
                        document.getElementById('spot-desc').innerHTML = description.html;
                        document.getElementById('spot-waterway').innerHTML = `<a href="./waterways/${waterways.slug}">${waterways.name}</a>`;

                        if (description.html !== "<p>None</p>") {
                          document.getElementById('spot-desc').innerHTML = description.html;
                        } else {
                          document.getElementById('spot-desc').innerHTML = "";
                        }
                      },
                      
                    }}
                  >
                  </Marker>
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
