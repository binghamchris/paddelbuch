import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql } from "gatsby";
import { RichText } from '@graphcms/rich-text-react-renderer';

export const pageQuery = graphql`
  query StaticPageQuery($slug: String!, $language: GraphCMS_Locale!) {
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
    page: graphCmsStaticPage(menu: {eq: About}, locale: {eq: $language}, slug: {eq: $slug}) {
      slug
      title
      pageContents {
        raw
      }
    }
  }
`;

export default function StaticPage({ data: { page } }) {
  return (
    <Layout pageName="about">
      <Helmet>
        <title>Swiss Paddel Buch - {page.title}</title>
      </Helmet>
      <Container type="content">
        <h1>{page.title}</h1>
        <RichText content={page.pageContents.raw} />
      </Container>
    </Layout>
  );
};