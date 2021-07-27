import React from "react";
import { Helmet } from "react-helmet";
import { Marker } from "react-leaflet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql, useStaticQuery } from "gatsby"
import { Container, Row, Col } from "react-bootstrap";

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
          id
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
            id
            slug
          }
          tours {
            id
            name
            slug
          }
          paddlingEnvironments {
            name
            id
          }
        }
      }
    }
  `)

  const mapSettings = {
    center: CENTER,
    //zoom: DEFAULT_ZOOM,
    bounds: MAP_BOUNDS,
  };
  
  return (
    <Layout pageName="home">
      <Helmet>
        <title>Swiss Canoe Map Prototype</title>
      </Helmet>
      <Container fluid noGutters>
        <Row noGutters className="justify-content-center">
          <Col id="map" xl="9" lg="9" md="12" sm="12" xs="12">
            <Map {...mapSettings}>
            { spots.nodes.map(spot => {
              const { id, name, location, description, waterways, paddlingEnvironments, tours } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker
                  key={id}
                  position={position}
                  eventHandlers={{
                    click: () => {
                      document.getElementById('welcome-message').hidden = true;
                      document.getElementById('spot-details').hidden = false;
                      document.getElementById('spot-name').textContent = name;
                      document.getElementById('spot-desc').textContent = description;
                      document.getElementById('spot-waterway').innerHTML = `<a href="./waterway/${waterways.slug}">${waterways.name}</a>`;
                      document.getElementById('spot-env').textContent = paddlingEnvironments.name;
                      const tour_list = tours.map(tours => {
                        const {
                          slug,
                          name
                        } = tours;
                        return `<li><a href="./tours/${slug}">${name}</a></li>`
                      }).join('');
                      document.getElementById('spot-tours').innerHTML = `<ul>${tour_list}</ul>`;

                      if (tours.length > 0) {
                        document.getElementById('spot-tours-container').hidden = false;
                        console.log("tours = true");
                      } else {
                        document.getElementById('spot-tours-container').hidden = true;
                        console.log("tours = false");
                      }   
                    }
                  }}
                >
                {/* <Popup><b>{ localizations[1].name }</b>  <br />  { localizations[1].description  }</Popup> */}
                </Marker>
              );
            })}
            </Map>
          </Col>
          <Col xl="3" lg="3" md="12" sm="12" xs="12">

            <div class="info-pane">
              <div id="welcome-message">
                <p>Please click a launching spot for information</p>
              </div>
              <div id="spot-details" hidden="true">
                <h1 id="spot-name"> </h1>
                <span id="spot-desc"></span>
                <h2>Waterway</h2>
                <span id="spot-waterway"></span>
                <h2>Paddling Environment</h2>
                <span id="spot-env"></span>
                <div id="spot-tours-container">
                  <h2>Tours</h2>
                  <span id="spot-tours"></span>
                </div>
              </div>
            </div>

          </Col>
        </Row>
      
      </Container>
    </Layout>
  );
};

export default IndexPage;
