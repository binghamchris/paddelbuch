import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql, Link } from "gatsby";
import { Marker, Popup, GeoJSON } from "react-leaflet";
import { Container, Row, Col } from "react-bootstrap";
import L from "leaflet";
//import * as markerStyle from '../../hooks/useMarkerStyles';
import * as layerStyle from '../../hooks/useLayerStyles';
import { RichText } from '@graphcms/rich-text-react-renderer';
import { isDomAvailable } from 'lib/util';

export const pageQuery = graphql`
  query LakePageQuery($slug: String!) {
    graphCmsWaterway(locale: {eq: en}, slug: {eq: $slug}) {
      name
      geometry
      spots {
        name
        description {
          raw
        }
        location {
          latitude
          longitude
        }
        spotType {
          slug
        }
        slug
      }
      protectedAreas {
        name
        geometry
        slug
        protectedAreaType {
          name
          slug
        }
        isAreaMarked
      }
      tours {
        name
        slug
        geometry
      }
      obstacles {
        slug
        portageRoute
        geometry
        name
        description {
          raw
        }
        isPortageNecessary
        isPortagePossible
        obstacleType {
          name
        }
      }
    }
  }
`;

export default function LakeDetailsPage({ data: { graphCmsWaterway } }) {
  var spotEinsteigAufsteigIcon
  var spotNurEinsteigIcon
  var spotNurAufsteigIcon
  var spotRaststatteIcon
  var mapSettings

  if (isDomAvailable()) {
    spotEinsteigAufsteigIcon = new L.icon({
      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",  
      shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      iconSize: [25, 41],
    })
    
    spotNurEinsteigIcon = new L.icon({
      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",  
      shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      iconSize: [25, 41],
    })
        
    spotNurAufsteigIcon = new L.icon({
      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",  
      shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      iconSize: [25, 41],
    })

    spotRaststatteIcon = new L.icon({
      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",  
      shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      iconSize: [25, 41],
    })

    const geometryL = L.geoJSON(graphCmsWaterway.geometry)
    const mapBounds = geometryL.getBounds()
    mapSettings = {
      bounds: mapBounds
    };
  }

  

  return(
    
    <Layout pageName="waterway-details">
      <Helmet>
        <title>Swiss Paddel Buch - Lakes - {graphCmsWaterway.name}</title>
      </Helmet>
      <Container fluid >
        <Row className="justify-content-center g-0">
          <Col id="map" xl="12" lg="12" md="12" sm="12" xs="12">
            <Map {...(!!mapSettings) ? mapSettings : null}>
              <GeoJSON data={graphCmsWaterway.geometry} style={layerStyle.lakeStyle}/>

              { graphCmsWaterway.protectedAreas.map(protectedArea => {
                const { name, geometry, protectedAreaType } = protectedArea;
                return (
                  <GeoJSON data={geometry} style={layerStyle.protectedAreaStyle}>
                    <Popup><b>{name}</b><br />{protectedAreaType.name}</Popup>
                  </GeoJSON>
                )
              
              })}

              { graphCmsWaterway.obstacles.map(obstacle => {
                const { name, geometry, obstacleType, portageRoute } = obstacle;
                return (
                  <div>
                    <GeoJSON data={geometry} style={layerStyle.obstacleStyle}>
                      <Popup><b>{name}</b><br />{obstacleType.name}</Popup>
                    </GeoJSON>
                    <GeoJSON data={portageRoute} style={layerStyle.portageStyle}>
                      <Popup><b>Portage route for {name}</b></Popup>
                    </GeoJSON>
                  </div>
                )
              
              })}

              { graphCmsWaterway.spots
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
              { graphCmsWaterway.spots
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
              { graphCmsWaterway.spots
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
              { graphCmsWaterway.spots
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
        <Row className="justify-content-center g-0 waterway-description waterway-title">
          <Col>
            <h1>{graphCmsWaterway.name}</h1>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};