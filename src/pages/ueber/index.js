import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql } from "gatsby";
import { Trans, useTranslation } from 'gatsby-plugin-react-i18next';

export const pageQuery = graphql`
  query AboutPageQuery($language: GraphCMS_Locale!) {
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
    spots: allGraphCmsSpot {
      distinct(field: slug)
    }
    lakes: allGraphCmsWaterway(
      filter: {paddlingEnvironments: {slug: {eq: "see"}}}
    ) {
      distinct(field: slug)
    }
    rivers: allGraphCmsWaterway(
      filter: {paddlingEnvironments: {slug: {eq: "fluss"}}}
    ) {
      distinct(field: slug)
    }
    whitewater: allGraphCmsWaterway(
      filter: {paddlingEnvironments: {slug: {eq: "wildwasser"}}}
    ) {
      distinct(field: slug)
    }
    obstacles: allGraphCmsObstacle {
      distinct(field: slug)
    }
    protectedAreas: allGraphCmsProtectedArea {
      distinct(field: slug)
    }
  }
`;

const AboutPage = ({ data }) => {

  const {t} = useTranslation();

  const spots = data.spots
  const lakes = data.lakes
  const rivers = data.rivers
  const whitewater = data.whitewater
  const obstacles = data.obstacles
  const protectedAreas = data.protectedAreas

  const spotCount = spots.distinct.length
  const lakeCount = lakes.distinct.length
  const riverCount = rivers.distinct.length
  const whitewaterCount = whitewater.distinct.length
  const obstacleCount = obstacles.distinct.length
  const protectedAreaCount = protectedAreas.distinct.length

  return (
    <Layout pageName="about">
      <Helmet>
        <title>{t(`Swiss Paddel Buch - About`)}</title>
      </Helmet>
      <Container type="content">
        <h1><Trans>About</Trans></h1>
        <p><Trans>Swiss Paddel Buch started following a sea kayaking roundtable meeting organised by Swiss Canoe in June 2021.</Trans></p>
        <p><Trans>The main goal of this project is to provide a central, nation-wide store of information for all types of paddlers in Switzerland, to enable members of the paddle sports community to better plan their trips and explore new waterways.</Trans></p>
        <h2><Trans>Contents</Trans></h2>
        <p><Trans>Swiss Paddel Buch currently contains:</Trans></p>
        <p>{spotCount} <Trans>spots</Trans>, {obstacleCount} <Trans>obstacles, and</Trans> {protectedAreaCount} <Trans>protected areas</Trans></p>
        <p><Trans>on</Trans></p>
        <p>{lakeCount} <Trans>lakes</Trans>, {riverCount} <Trans>rivers, and</Trans> {whitewaterCount} <Trans>whitewater sections</Trans></p>
        <h2><Trans>Disclaimer</Trans></h2>
        <p><Trans>This website and the public database/API are created and maintained on a voluntary basis by members of the Swiss paddle sports community. As such, the information provided, both in this website and in the public database/API, is provided without warranty or guarantee. The operators of this website and the public database/API accept no responsibility for the accuracy or usage of the information provided.</Trans></p>
        <p><Trans>It is always the user's responsibility to exercise appropriate caution and follow all applicable laws and safety guidelines when using this information.</Trans></p>
      </Container>
    </Layout>
  );
};

export default AboutPage;
