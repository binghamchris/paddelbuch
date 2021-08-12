import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql } from "gatsby";
import { Marker, Popup, GeoJSON } from "react-leaflet";
import { Container, Row, Col } from "react-bootstrap";
import L from "leaflet";
import * as layerStyle from '../../hooks/useLayerStyles';
import { RichText } from '@graphcms/rich-text-react-renderer';
import { isDomAvailable } from 'lib/util';
import  { markerStyles } from 'lib/marker-styles';
import { Link, Trans, useTranslation } from 'gatsby-plugin-react-i18next';

export const pageQuery = graphql`
  query LakePageQuery($slug: String!, $language: GraphCMS_Locale!) {
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
    graphCmsWaterway(locale: {eq: $language}, slug: {eq: $slug}) {
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

  const {t} = useTranslation();

  var spotEinsteigAufsteigIcon
  var spotNurEinsteigIcon
  var spotNurAufsteigIcon
  var spotRaststatteIcon
  var mapSettings

  if (isDomAvailable()) {
    spotEinsteigAufsteigIcon = new L.icon(markerStyles.spotEinsteigAufsteigIcon)
    spotNurEinsteigIcon = new L.icon(markerStyles.spotNurEinsteigIcon)
    spotNurAufsteigIcon = new L.icon(markerStyles.spotNurAufsteigIcon)
    spotRaststatteIcon = new L.icon(markerStyles.spotRaststatteIcon)

    const geometryL = L.geoJSON(graphCmsWaterway.geometry)
    const mapBounds = geometryL.getBounds()
    mapSettings = {
      bounds: mapBounds
    };
  } 

  return(
    
    <Layout pageName="waterway-details">
      <Helmet>
        <title>{t(`Swiss Paddel Buch - Waterways`)} - {graphCmsWaterway.name}</title>
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
                const { name, geometry, obstacleType, portageRoute, slug } = obstacle;
                return (
                  <div>
                    <GeoJSON data={geometry} style={layerStyle.obstacleStyle}>
                      <Popup>
                        <b>{name}</b>
                        <br />{obstacleType.name}
                        <p><Link to={`/obstacles/${slug}`}><Trans>More details</Trans></Link></p>
                      </Popup>
                    </GeoJSON>
                    <GeoJSON data={portageRoute} style={layerStyle.portageStyle}>
                      <Popup><b><Trans>Portage route for</Trans> {name}</b></Popup>
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
                    <p><Link to={`/spots/${slug}`}><Trans>More details</Trans></Link></p>
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
                    <p><Link to={`/spots/${slug}`}><Trans>More details</Trans></Link></p>
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
                    <p><Link to={`/spots/${slug}`}><Trans>More details</Trans></Link></p>
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
                    <p><Link to={`/spots/${slug}`}><Trans>More details</Trans></Link></p>
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