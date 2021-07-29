import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";

const SecondPage = () => {

  return (
    <Layout pageName="about">
      <Helmet>
        <title>Swiss Paddel Buch - API</title>
      </Helmet>
      <Container type="content">
        <h1>Public Database / API</h1>
        <p>All of the information provided in this website is also available via the <a href="https://api-eu-central-1.graphcms.com/v2/ckq3v9412ku0401w70mgs10qp/master">Swiss Paddel Buch public GraphQL API.</a></p>
      </Container>
    </Layout>
  );
};

export default SecondPage;
