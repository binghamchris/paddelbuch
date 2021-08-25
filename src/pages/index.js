import React from "react";
import { Helmet } from "react-helmet";
import { Marker } from "react-leaflet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql } from "gatsby"
import { Container, Row, Col } from "react-bootstrap";
import { isDomAvailable } from 'lib/util';
import L from "leaflet";
import  { markerStyles } from 'data/marker-styles';
import { Trans, useTranslation } from 'gatsby-plugin-react-i18next';

const CH_CENTRE = {
  lat: 46.801111,
  lng: 8.226667,
};
const MAP_BOUNDS = [
  [45.8057848,5.9211795],
  [47.7983545,10.524451]
]
const CENTER = [CH_CENTRE.lat, CH_CENTRE.lng];

function IndexPage ({ data }) {

  const spots = data.spots

  const {t} = useTranslation();

  var spotEinsteigAufsteigIcon
  var spotNurEinsteigIcon
  var spotNurAufsteigIcon
  var spotRasthalteIcon

  if (isDomAvailable()) {
    spotEinsteigAufsteigIcon = new L.icon(markerStyles.spotEinsteigAufsteigIcon)
    spotNurEinsteigIcon = new L.icon(markerStyles.spotNurEinsteigIcon)
    spotNurAufsteigIcon = new L.icon(markerStyles.spotNurAufsteigIcon)
    spotRasthalteIcon = new L.icon(markerStyles.spotRasthalteIcon)
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
                        document.getElementById('spot-waterway').innerHTML = `<a href="./wasserlaeufe/${waterways.slug}">${waterways.name}</a>`;
                        document.getElementById('spot-gps').textContent = location.latitude + ", " + location.longitude;
                        document.getElementById('spot-address').textContent = approximateAddress;
                        document.getElementById('spot-link').innerHTML = `<a href="./einsteigsorte/${slug}">` + t('More details') + `</a>`;
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
                        document.getElementById('spot-waterway').innerHTML = `<a href="./wasserlaeufe/${waterways.slug}">${waterways.name}</a>`;
                        document.getElementById('spot-gps').textContent = location.latitude + ", " + location.longitude;
                        document.getElementById('spot-address').textContent = approximateAddress;
                        document.getElementById('spot-link').innerHTML = `<a href="./einsteigsorte/${slug}">` + t('More details') + `</a>`;
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
                        document.getElementById('spot-waterway').innerHTML = `<a href="./wasserlaeufe/${waterways.slug}">${waterways.name}</a>`;
                        document.getElementById('spot-gps').textContent = location.latitude + ", " + location.longitude;
                        document.getElementById('spot-address').textContent = approximateAddress;
                        document.getElementById('spot-link').innerHTML = `<a href="./einsteigsorte/${slug}">` + t('More details') + `</a>`;
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
              .filter(spot => spot.spotType.slug === "rasthalte")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker
                    key={slug}
                    position={position}
                    icon={(!!spotRasthalteIcon) ? spotRasthalteIcon : null}
                    eventHandlers={{
                      click: () => {
                        document.getElementById('welcome-message').hidden = true;
                        document.getElementById('spot-details').hidden = false;
                        document.getElementById('spot-name').textContent = name;
                        document.getElementById('spot-desc').innerHTML = description.html;
                        document.getElementById('spot-waterway').innerHTML = `<a href="./wasserlaeufe/${waterways.slug}">${waterways.name}</a>`;
                        document.getElementById('spot-gps').textContent = location.latitude + ", " + location.longitude;
                        document.getElementById('spot-address').textContent = approximateAddress;
                        document.getElementById('spot-link').innerHTML = `<a href="./einsteigsorte/${slug}">` + t('More details') + `</a>`;
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
            <div className="info-pane">
              <div id="welcome-message">
               <p><Trans>Please click a spot for information</Trans></p>
              </div>
              <div id="spot-details" hidden={true}>
                <h1 id="spot-name"> </h1>
                <span id="spot-desc"></span>
                <p><b><Trans>Type</Trans>:</b> <span id="spot-type"></span></p>
                <p><b><Trans>GPS</Trans>:</b> <span id="spot-gps"></span></p>
                <p><b><Trans>Approx. Address</Trans>:</b> <span id="spot-address"></span></p>
                <p><b><Trans>Waterway</Trans>:</b> <span id="spot-waterway"></span></p>
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


export const pageQuery = graphql`
  query($language: GraphCMS_Locale!) {
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
    spots: allGraphCmsSpot(filter: {locale: {eq: $language}}) {
      nodes {
        name
        approximateAddress
        description {
          html
          raw
        }
        location {
          latitude
          longitude
        }
        waterways {
          name
          slug
        }
        spotType {
          name
          slug
        }
        slug
      }
    }
  }
`;