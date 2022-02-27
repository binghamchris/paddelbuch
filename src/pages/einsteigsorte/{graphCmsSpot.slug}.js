import * as React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Map from "components/Map";
import { graphql } from "gatsby";
import { Marker, Popup, GeoJSON } from "react-leaflet";
import { Container, Row, Col } from "react-bootstrap";
import * as layerStyle from 'data/layer-styles';
import { RichText } from '@graphcms/rich-text-react-renderer';
import { isDomAvailable } from 'lib/util';
import L from "leaflet";
import  { markerStyles } from 'data/marker-styles';
import { Link, Trans, useTranslation } from 'gatsby-plugin-react-i18next';

export const pageQuery = graphql`
  query SpotPageQuery($slug: String!, $language: GraphCMS_Locale!) {
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
    thisSpot: graphCmsSpot(locale: {eq: $language}, slug: {eq: $slug}) {
      name
      approximateAddress
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
      waterways {
        name
        slug
      }
      slug    
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
    protectedAreas: allGraphCmsProtectedArea(filter: {locale: {eq: $language}}) {
      nodes {
        name
        geometry
        slug
        protectedAreaType {
          name
          slug
        }
        isAreaMarked
      }
    }
    obstacles: allGraphCmsObstacle(filter: {locale: {eq: $language}}) {
      nodes {
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
          slug
        }
      }
    }
  }
`;

export default function SpotDetailsPage({ data: { thisSpot, spots, protectedAreas, obstacles } }) {

  const {t} = useTranslation();

  var spotEinsteigAufsteigIcon
  var spotNurEinsteigIcon
  var spotNurAufsteigIcon
  var spotRasthalteIcon
  var spotNotauswasserungIcon

  if (isDomAvailable()) {
    spotEinsteigAufsteigIcon = new L.icon(markerStyles.spotEinsteigAufsteigIcon)
    spotNurEinsteigIcon = new L.icon(markerStyles.spotNurEinsteigIcon)
    spotNurAufsteigIcon = new L.icon(markerStyles.spotNurAufsteigIcon)
    spotRasthalteIcon = new L.icon(markerStyles.spotRasthalteIcon)
    spotNotauswasserungIcon = new L.icon(markerStyles.spotNotauswasserungIcon)
  }

  const mapSettings = {
    center: [thisSpot.location.latitude, thisSpot.location.longitude],
    zoom: 16,
  };

  return(
    
    <Layout pageName="spot-details">
      <Helmet>
        <title>{t(`Swiss Paddel Buch - Spots`)} - {thisSpot.name}</title>
      </Helmet>
      <Container fluid >
        <Row className="justify-content-center g-0">
          <Col id="map" xl="12" lg="12" md="12" sm="12" xs="12">
            <Map {...mapSettings}>

            { spots.nodes
              .filter(spot => spot.spotType.slug === "einsteig-aufsteig")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotEinsteigAufsteigIcon) ? spotEinsteigAufsteigIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                      <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                      <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                      <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                      <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>}
                  </Marker>
                );
            })}

            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-einsteig")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurEinsteigIcon) ? spotNurEinsteigIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                      <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                      <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                      <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                      <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>}
                  </Marker>
                );
            })}

            { spots.nodes
              .filter(spot => spot.spotType.slug === "nur-aufsteig")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType  } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNurAufsteigIcon) ? spotNurAufsteigIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                      <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                      <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                      <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                      <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>}
                  </Marker>
                );
            })}

            { spots.nodes
              .filter(spot => spot.spotType.slug === "rasthalte")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType  } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotRasthalteIcon) ? spotRasthalteIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                      <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                      <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                      <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                    <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>}
                  </Marker>
                );
            })}

              { spots.nodes
              .filter(spot => spot.spotType.slug === "notauswasserungsstelle")
              .map(spot => {
                const { name, location, description, waterways, slug, approximateAddress, spotType  } = spot;
                const position = [location.latitude, location.longitude];
                return (
                  <Marker key={slug} position={position} icon={(!!spotNotauswasserungIcon) ? spotNotauswasserungIcon : null}>
                    {<Popup>
                      <b>{name}</b>
                      <RichText content={description.raw} />
                      <p><b><Trans>Type</Trans>:</b> {spotType.name}</p>
                      <p><b><Trans>GPS</Trans>:</b> {location.latitude}, {location.longitude}</p>
                      <p><b><Trans>Approx. Address</Trans>:</b> {approximateAddress}</p>
                      <p><b><Trans>Waterway</Trans>:</b> {waterways.name}</p>
                    <p><Link to={`/einsteigsorte/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>}
                  </Marker>
                );
            })}

            { protectedAreas.nodes
              .map(protectedArea => {
              const { name, geometry, protectedAreaType } = protectedArea;
              return (
                <GeoJSON data={geometry} style={layerStyle.protectedAreaStyle}>
                  <Popup>
                    <b>{name}</b>
                    <br />{protectedAreaType.name}
                  </Popup>
                </GeoJSON>
              )              
            })}
            
            { obstacles.nodes
              .map(obstacle => {
              const { name, geometry, obstacleType, portageRoute, slug } = obstacle;
              return (
                <div>
                  <GeoJSON data={geometry} style={layerStyle.obstacleStyle}>
                    <Popup>
                      <b>{name}</b>
                      <br />{obstacleType.name}
                      <p><Link to={`/hindernisse/${slug}`}><Trans>More details</Trans></Link></p>
                    </Popup>
                  </GeoJSON>
                  <GeoJSON data={portageRoute} style={layerStyle.portageStyle}>
                    <Popup><b><Trans>Portage route for</Trans> {name}</b></Popup>
                  </GeoJSON>
                </div>
              )            
              })}

            </Map>
          </Col>
        </Row>
        <Row className="justify-content-center g-0 spot-description spot-title">
          <Col>
            <h1>{thisSpot.name}</h1>
          </Col>
        </Row>
        <Row className="justify-content-center g-0 spot-description">
          <Col xl="12" lg="12" md="12" sm="12" xs="12">
            <h2>Spot Details</h2>
            <RichText content={thisSpot.description.raw} />
            <p><b><Trans>Type</Trans>:</b> {thisSpot.spotType.name}</p>
            <p><b><Trans>GPS</Trans>:</b> {thisSpot.location.latitude}, {thisSpot.location.longitude}</p>
            <p><b><Trans>Approx. Address</Trans>:</b> {thisSpot.approximateAddress}</p>
            <p><b><Trans>Waterway</Trans>:</b> <Link to={`/gewaesser/${thisSpot.waterways.slug}`}>{thisSpot.waterways.name}</Link></p>
          </Col>
        </Row>
      </Container>
    </Layout>
  )
};