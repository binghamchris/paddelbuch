import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql } from "gatsby";
import { Trans, useTranslation } from 'gatsby-plugin-react-i18next';

export const pageQuery = graphql`
  query ApiPageQuery($language: GraphCMS_Locale!) {
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
  }
`;

const ApiPage = () => {

  const {t} = useTranslation();

  return (
    <Layout pageName="about">
      <Helmet>
        <title>{t(`Swiss Paddel Buch - API`)}</title>
      </Helmet>
      <Container type="content">
        <h1><Trans>Public Database / API</Trans></h1>
        <p><Trans>All of the information provided in this website is also available via the</Trans> <a href="https://api-eu-central-1.graphcms.com/v2/ckq3v9412ku0401w70mgs10qp/master"><Trans>Swiss Paddel Buch public GraphQL API.</Trans></a></p>
      </Container>
    </Layout>
  );
};

export default ApiPage;
