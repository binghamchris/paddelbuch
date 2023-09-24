import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql } from "gatsby";
//import { RichText } from '@graphcms/rich-text-react-renderer';

export const pageQuery = graphql`
  query StaticPageQuery($slug: String!, $language: String!) {
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
    page: contentfulStaticPage(menu: {eq: About}, node_locale: {eq: $language}, slug: {eq: $slug}) {
      slug
      title
      pageContents {
        json
      }
    }
  }
`;

export default function StaticPage({ data: { page } }) {
  return (
    <Layout pageName="about">
      <Helmet>
        <title>Paddel Buch - {page.title}</title>
      </Helmet>
      <Container type="content">
        <h1>{page.title}</h1>
        <RichText content={page.pageContents.raw} />
      </Container>
    </Layout>
  );
};