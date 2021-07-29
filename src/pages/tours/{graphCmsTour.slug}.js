import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql } from "gatsby";
import { Polyline, Marker, Popup } from "react-leaflet";
import { Container, Row, Col } from "react-bootstrap";

export const pageQuery = graphql`
  query TourPageQuery($slug: String!) {
    graphCmsTour(locale: {eq: en}, slug: {eq: $slug}) {
      id
      slug
      name
      description {
        html
      }
      oneWayDistance
      paddlingTimeOneWayCanoe
      paddlingTimeOneWayKayak
      paddlingTimeOneWaySup
      geometry
      hazardEnvironment {
        html
      }
      hazardTraffic {
        html
      }
      hazardWeather {
        html
      }
      hazardWildlife {
        html
      }
      paddlingEnvironments {
        name
        id
      }
      waterways {
        name
        id
      }
      spots {
        name
        description {
          html
        }
        location {
          latitude
          longitude
        }
        tours {
          name
          slug
        }
      }
    }
  }
`;

const redOptions = { color: 'red' }

export default function TourDetailsPage({ data: { graphCmsTour } }) {
  const mapSettings = {
    bounds: graphCmsTour.geometry.coordinates,
  };

  return(
    
    <Layout pageName="tour-details">
      <Helmet>
        <title>Swiss Paddel Buch - Tour - {graphCmsTour.name}</title>
      </Helmet>

      <Container fluid noGutters>
        <Row noGutters className="justify-content-center">
          <Col id="map" xl="9" lg="9" md="12" sm="12" xs="12">
            <Map {...mapSettings}>
              <Polyline pathOptions={redOptions} positions={graphCmsTour.geometry.coordinates} />
              { graphCmsTour.spots.map(spot => {
              const { id, name, location, description } = spot;
              const position = [location.latitude, location.longitude];
              return (
                <Marker
                  key={id}
                  position={position}
                >
                {<Popup><b>{ name }</b>  <br />  { description }</Popup>}
                </Marker>
                );
              })}
            </Map>
          </Col>
          <Col xl="3" lg="3" md="12" sm="12" xs="12">
            <div class="info-pane">
              <React.Fragment id="info-pane">
                <h1>{graphCmsTour.name}</h1>
                <p>{graphCmsTour.description}</p>
                <p>Please scroll down for more details</p>
              </React.Fragment>
            </div>
          </Col>
        </Row>
        <Row>
          <Col xl="6" lg="6" md="12" sm="12" xs="12">
            <div class="info-pane">
              <React.Fragment id="info-pane">
                <h2>How long does this tour take?</h2>
                This tour is {graphCmsTour.OneWayDistance} km long one way. Typically, this distance takes the following time to paddle:
                <table>
                  <tbody>
                    <tr>  
                      <th>Kayak:</th>
                      <td>{graphCmsTour.paddlingTimeOneWayKayak} hours</td>
                    </tr>
                    <tr>  
                      <th>Canoe:</th>
                      <td>{graphCmsTour.paddlingTimeOneWayCanoe} hours</td>
                    </tr>
                    <tr>  
                      <th>SUP:</th>
                      <td>{graphCmsTour.paddlingTimeOneWaySup} hours</td>
                    </tr>
                  </tbody>
                </table>
              </React.Fragment>
            </div>
          </Col>
          <Col xl="6" lg="6" md="12" sm="12" xs="12">
            <div class="info-pane">
              <React.Fragment id="info-pane">
                <h2>What hazards are found on this tour?</h2>
                <h3>Environment</h3>
                <p>{graphCmsTour.hazardEnvironment}</p>
                <h3>Traffic</h3>
                <p>{graphCmsTour.hazardTraffic}</p>
                <h3>Weather</h3>
                <p>{graphCmsTour.hazardWeather}</p>
                <h3>Wildlife</h3>
                <p>{graphCmsTour.hazardWildlife}</p>
              </React.Fragment>
            </div>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};

