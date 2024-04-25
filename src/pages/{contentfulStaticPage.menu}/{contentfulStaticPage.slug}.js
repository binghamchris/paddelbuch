import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql } from "gatsby";
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';

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
    page: contentfulStaticPage(node_locale: {eq: $language}, slug: {eq: $slug}) {
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
    <Layout pageName="static">
      <Helmet>
        <title>Paddel Buch - {page.title}</title>
      </Helmet>
      <Container type="content">
        <h1>{page.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: 
          documentToHtmlString(JSON.parse(page.pageContents.raw))
        }} />
      </Container>
    </Layout>
  );
};