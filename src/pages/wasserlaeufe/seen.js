import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql } from "gatsby";
import { Link, Trans, useTranslation } from 'gatsby-plugin-react-i18next';

export const pageQuery = graphql`
  query LakesPageQuery($language: GraphCMS_Locale!) {
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
    lakes: allGraphCmsWaterway(
      filter: {locale: {eq: $language}, paddlingEnvironments: {slug: {eq: "see"}}}
      sort: {fields: name}
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
        <title>{t(`Swiss Paddel Buch - Lakes`)}</title>
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
                        <Link to={`/wasserlaeufe/${slug}`}>
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
