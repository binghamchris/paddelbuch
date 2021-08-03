import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql, useStaticQuery } from "gatsby"

const AboutPage = () => {

  const { spots, lakes, rivers, whitewater, obstacles, protectedAreas } = useStaticQuery(graphql`
    query {
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
  `)

  const spotCount = spots.distinct.length
  const lakeCount = lakes.distinct.length
  const riverCount = rivers.distinct.length
  const whitewaterCount = whitewater.distinct.length
  const obstacleCount = obstacles.distinct.length
  const protectedAreaCount = protectedAreas.distinct.length

  return (
    <Layout pageName="about">
      <Helmet>
        <title>Swiss Paddel Buch - About</title>
      </Helmet>
      <Container type="content">
        <h1>About</h1>
        <p>Swiss Paddel Buch started following a sea kayaking roundtable meeting organised by <a href="http://swisscanoe.ch/de/seekajak">Swiss Canoe</a> in June 2021.</p>
        <p>The main goal of this project is to provide a central, nation-wide store of information for all types of paddlers in Switzerland, to enable members of the paddle sports community to better plan their trips and explore new waterways.</p>
        <h2>Contents</h2>
        <p>Swiss Paddel Buch currently contains:</p>
        <p>{spotCount} spots, {obstacleCount} obstacles, and {protectedAreaCount} protected areas</p>
        <p>on</p>
        <p>{lakeCount} lakes, {riverCount} rivers, and {whitewaterCount} whitewater sections</p>
        <h2>Disclaimer</h2>
        <p>This website and the public database/API are created and maintained on a voluntary basis by members of the Swiss paddle sports community. As such, the information provided, both in this website and in the public database/API, is provided without warranty or guarantee. The operators of this website and the public database/API accept no responsibility for the accuracy or usage of the information provided.</p>
        <p>It is always the user's responsibility to exercise appropriate caution and follow all applicable laws and safety guidelines when using this information.</p>
      </Container>
    </Layout>
  );
};

export default AboutPage;
