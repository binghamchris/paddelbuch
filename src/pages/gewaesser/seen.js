import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql } from "gatsby";
import { Link, Trans, useTranslation } from 'gatsby-plugin-react-i18next';

export const pageQuery = graphql`
  query LakesPageQuery($language: String!) {
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
    lakes: allContentfulWaterway(
      filter: {node_locale: {eq: $language}, paddlingEnvironmentType: {slug: {eq: "see"}}}
      sort: {name: ASC}
    ) {
      nodes {
        name
        slug
      }
    }
  }
`;

const LakesListPage = ({ data }) => {

  const {t} = useTranslation();

  const lakes = data.lakes

  return (
    <Layout pageName="lakes">
      <Helmet>
        <title>{t(`Paddel Buch - Lakes`)}</title>
      </Helmet>

      <Container className="lakes-list">
        <h2><Trans>Lakes</Trans></h2>
        <table>
          <tbody>
            <tr>
              <th><Trans>Name</Trans></th>
            </tr>
            { lakes.nodes.map(lakes => {
              const {
                name,
                slug
              } = lakes;

              return <tr>
                      <td>
                        <Link to={`/gewaesser/${slug}`}>
                          {name}
                        </Link>
                      </td>
                    </tr> 
            })}
          </tbody>
        </table>
      </Container>
    </Layout>
  );
};

export default LakesListPage;
