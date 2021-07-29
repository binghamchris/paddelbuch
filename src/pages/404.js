import React from "react";

import Layout from "components/Layout";
import Container from "components/Container";

const NotFoundPage = () => {
  return (
    <Layout>
      <Container type="content" className="text-center">
        <h1>404 - Page Not Found</h1>
        <p>This page doesn't exist yet!</p>
        <p>Please try another page from the menu above.</p>
      </Container>
    </Layout>
  );
};

export default NotFoundPage;
