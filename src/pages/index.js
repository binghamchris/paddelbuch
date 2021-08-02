import React from "react";
import { Helmet } from "react-helmet";
import { Marker } from "react-leaflet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql, useStaticQuery } from "gatsby"
import { Container, Row, Col } from "react-bootstrap";
import { isDomAvailable } from 'lib/util';
import L from "leaflet";
import  { markerStyles } from 'lib/marker-styles';

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
          approximateAddress
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
            name
            slug
          }
          slug
        }
      }
    }
  `)

  var spotEinsteigAufsteigIcon
  var spotNurEinsteigIcon
  var spotNurAufsteigIcon
  var spotRaststatteIcon

  if (isDomAvailable()) {
    spotEinsteigAufsteigIcon = new L.icon(markerStyles.spotEinsteigAufsteigIcon)
    spotNurEinsteigIcon = new L.icon(markerStyles.spotNurEinsteigIcon)
    spotNurAufsteigIcon = new L.icon(markerStyles.spotNurAufsteigIcon)
    spotRaststatteIcon = new L.icon(markerStyles.spotRaststatteIcon)
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
            { spots.nodes
              .filter(spot => spot.spotType.slug === "einsteig-aufsteig")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker
                    key={slug}
                    position={position}
                    icon={(!!spotEinsteigAufsteigIcon) ? spotEinsteigAufsteigIcon : null}
                    eventHandlers={{
                      click: () => {
                        document.getElementById('welcome-message').hidden = true;
                        document.getElementById('spot-details').hidden = false;
                        document.getElementById('spot-name').textContent = name;
                        document.getElementById('spot-desc').innerHTML = description.html;
                        document.getElementById('spot-waterway').innerHTML = `<a href="./waterways/${waterways.slug}">${waterways.name}</a>`;
                        document.getElementById('spot-gps').textContent = location.latitude + ", " + location.longitude;
                        document.getElementById('spot-address').textContent = approximateAddress;
                        document.getElementById('spot-link').innerHTML = `<a href="./spots/${slug}">More details</a>`;
                        document.getElementById('spot-type').textContent = spotType.name;

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
                const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker
                    key={slug}
                    position={position}
                    icon={(!!spotNurEinsteigIcon) ? spotNurEinsteigIcon : null}
                    eventHandlers={{
                      click: () => {
                        document.getElementById('welcome-message').hidden = true;
                        document.getElementById('spot-details').hidden = false;
                        document.getElementById('spot-name').textContent = name;
                        document.getElementById('spot-desc').innerHTML = description.html;
                        document.getElementById('spot-waterway').innerHTML = `<a href="./waterways/${waterways.slug}">${waterways.name}</a>`;
                        document.getElementById('spot-gps').textContent = location.latitude + ", " + location.longitude;
                        document.getElementById('spot-address').textContent = approximateAddress;
                        document.getElementById('spot-link').innerHTML = `<a href="./spots/${slug}">More details</a>`;
                        document.getElementById('spot-type').textContent = spotType.name;

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
                const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker
                    key={slug}
                    position={position}
                    icon={(!!spotNurAufsteigIcon) ? spotNurAufsteigIcon : null}
                    eventHandlers={{
                      click: () => {
                        document.getElementById('welcome-message').hidden = true;
                        document.getElementById('spot-details').hidden = false;
                        document.getElementById('spot-name').textContent = name;
                        document.getElementById('spot-desc').innerHTML = description.html;
                        document.getElementById('spot-waterway').innerHTML = `<a href="./waterways/${waterways.slug}">${waterways.name}</a>`;
                        document.getElementById('spot-gps').textContent = location.latitude + ", " + location.longitude;
                        document.getElementById('spot-address').textContent = approximateAddress;
                        document.getElementById('spot-link').innerHTML = `<a href="./spots/${slug}">More details</a>`;
                        document.getElementById('spot-type').textContent = spotType.name;

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
                const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker
                    key={slug}
                    position={position}
                    icon={(!!spotRaststatteIcon) ? spotRaststatteIcon : null}
                    eventHandlers={{
                      click: () => {
                        document.getElementById('welcome-message').hidden = true;
                        document.getElementById('spot-details').hidden = false;
                        document.getElementById('spot-name').textContent = name;
                        document.getElementById('spot-desc').innerHTML = description.html;
                        document.getElementById('spot-waterway').innerHTML = `<a href="./waterways/${waterways.slug}">${waterways.name}</a>`;
                        document.getElementById('spot-gps').textContent = location.latitude + ", " + location.longitude;
                        document.getElementById('spot-address').textContent = approximateAddress;
                        document.getElementById('spot-link').innerHTML = `<a href="./spots/${slug}">More details</a>`;
                        document.getElementById('spot-type').textContent = spotType.name;

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
                <p><b>Type:</b> <span id="spot-type"></span></p>
                <p><b>GPS:</b> <span id="spot-gps"></span></p>
                <p><b>Approx. Address:</b> <span id="spot-address"></span></p>
                <p><b>Waterway: </b><span id="spot-waterway"></span></p>
                <p><span id="spot-link"></span></p>
              </div>
            </div>
          </Col>
        </Row>
      
      </Container>
    </Layout>
  );
};

export default IndexPage;
