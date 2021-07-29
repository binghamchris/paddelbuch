import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";

const SecondPage = () => {

  return (
    <Layout pageName="about">
      <Helmet>
        <title>Swiss Paddel Buch - About</title>
      </Helmet>
      <Container type="content">
        <h1>About</h1>
        <p>Swiss Paddel Buch started following a Sea kayaking roundtable meeting organised by <a href="http://swisscanoe.ch/de/seekajak">Swiss Canoe</a> in June 2021.</p>
        <p>The main goal of this project is to provide a central, national store of information for all types of paddlers in Switzerland, to enable members of the paddle sports community to better plan their trips and explore new waterways.</p>
        <h2>Disclaimer</h2>
        <p>This website and the public database/API are created and maintained on a voluntary basis by members of the Swiss paddle sports community. As such, the information provided, both in this website and in the public database/API, is provided without warranty or guarantee. The operators of this website and the public database/API accept no responsibility for the accuracy or usage of the information provided.</p>
        <p>It is always the user's responsibility to exercise appropriate caution and follow all applicable laws and safety guidelines when using this information.</p>
      </Container>
    </Layout>
  );
};

export default SecondPage;
