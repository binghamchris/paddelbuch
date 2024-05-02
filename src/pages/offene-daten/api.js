import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql } from "gatsby";
import { Link, Trans, useTranslation } from '@herob191/gatsby-plugin-react-i18next';

export const pageQuery = graphql`
  query StaticPageQuery($language: String!) {
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
    lastUpdateSpot: allContentfulSpot(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdateObstacle: allContentfulObstacle(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdateWaterwayEvent: allContentfulWaterwayEventNotice(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdateProtectedArea: allContentfulProtectedArea(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdateWaterway: allContentfulWaterway(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdateDataLicense: allContentfulDataLicenseType(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdateDataSource: allContentfulDataSourceType(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdateObstacleType: allContentfulObstacleType(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdatePaddleCraftType: allContentfulPaddleCraftType(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdateProtectedAreaType: allContentfulProtectedAreaType(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdateSpotType: allContentfulSpotType(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
    lastUpdatePaddlingEnvironmentType: allContentfulPaddlingEnvironmentType(sort: {updatedAt: DESC}, limit: 1) {
      nodes {
        updatedAt
      }
    }
  }
`;


export default function StaticPage({ data: { 
  lastUpdateSpot,
  lastUpdateObstacle,
  lastUpdateWaterwayEvent,
  lastUpdateProtectedArea,
  lastUpdateWaterway,
  lastUpdateDataLicense,
  lastUpdateDataSource,
  lastUpdateObstacleType,
  lastUpdatePaddleCraftType,
  lastUpdateProtectedAreaType,
  lastUpdateSpotType,
  lastUpdatePaddlingEnvironmentType
} }) {
  const {t} = useTranslation();

  return (
    <Layout pageName="api">
      <Helmet>
        <title>Paddel Buch - {t(`Data Download / API`)}</title>
      </Helmet>
      <Container type="content">
        <h1><Trans>Data Download / API</Trans></h1>
        <p>
          <Trans>All of Paddel Buch's data is available here for download and reuse under the terms described in the </Trans>
          <Link to={`/offene-daten/datenlizenzen`}><Trans>Data Licensing</Trans></Link>
          <Trans> page.</Trans>
        </p>
        <p>
          <Trans>Data is published as JSON files which are updated automatically when Paddel Buch's data is changed. </Trans>
          <Trans>German and English data is available in separate files, which can be joined using their slug fields.</Trans>
        </p>
        <h2><Trans>Last Update Index</Trans></h2>
        <p>
          <Trans>This file provides a list of all the tables and the ISO timestamp for when each was last updated.</Trans>
        <p>
        </p>
          <a href="/api/lastUpdateIndex.json"><Trans>Last Update Index</Trans></a>
        </p>
        <h2><Trans>Fact Tables</Trans></h2>
        <p>
          <Trans>These tables contain Paddel Buch's primary data and are updated most frequently.</Trans>
        </p>
        <table>
          <tbody>
            <tr>
              <th><Trans>Table Name</Trans></th>
              <th><Trans>German Download</Trans></th>
              <th><Trans>English Download</Trans></th>
              <th><Trans>Last Updated</Trans></th>
            </tr>
            <tr>
              <td>Spots</td>
              <td><a href="/api/spots-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/spots-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdateSpot.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
            <tr>
              <td>Waterway Event Notices</td>
              <td><a href="/api/waterwayevents-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/waterwayevents-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdateWaterwayEvent.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
            <tr>
              <td>Obstacles</td>
              <td><a href="/api/obstacles-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/obstacles-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdateObstacle.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
            <tr>
              <td>Protected Areas</td>
              <td><a href="/api/protectedareas-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/protectedareas-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdateProtectedArea.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
            <tr>
              <td>Waterways</td>
              <td><a href="/api/waterways-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/waterways-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdateWaterway.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
          </tbody>
        </table>
        <h2><Trans>Dimension Tables</Trans></h2>
        <p>
          <Trans>These tables contain dimension data referenced by entries in the fact tables via their slugs.</Trans>
        </p>
        <table>
          <tbody>
            <tr>
              <th><Trans>Table Name</Trans></th>
              <th><Trans>German Download</Trans></th>
              <th><Trans>English Download</Trans></th>
              <th><Trans>Last Updated</Trans></th>
            </tr>
            <tr>
              <td>Data Licenses Types</td>
              <td><a href="/api/datalicensetypes-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/datalicensetypes-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdateDataLicense.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
            <tr>
              <td>Data Source Types</td>
              <td><a href="/api/datasourcetypes-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/datasourcetypes-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdateDataSource.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
            <tr>
              <td>Obstacle Types</td>
              <td><a href="/api/obstacletypes-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/obstacletypes-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdateObstacleType.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
            <tr>
              <td>Paddle Craft Types</td>
              <td><a href="/api/paddlecrafttypes-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/paddlecrafttypes-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdatePaddleCraftType.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
            <tr>
              <td>Paddling Envrionment Types</td>
              <td><a href="/api/paddlingenvironmenttypes-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/paddlingenvironmenttypes-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdatePaddlingEnvironmentType.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
            <tr>
              <td>Protected Area Types</td>
              <td><a href="/api/protectedareatypes-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/protectedareatypes-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdateProtectedAreaType.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
            <tr>
              <td>Spot Types</td>
              <td><a href="/api/spottypes-de.json"><Trans>German</Trans> </a></td>
              <td><a href="/api/spottypes-en.json"><Trans>English</Trans> </a></td>
              <td>{JSON.stringify(lastUpdateSpotType.nodes[0].updatedAt).replace(`"`, ``).replace(`"`, ``)}</td>
            </tr>
          </tbody>
        </table> 
      </Container>
    </Layout>
  );
};