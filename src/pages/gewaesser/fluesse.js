import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql } from "gatsby";
import { Link, Trans, useTranslation } from '@herob191/gatsby-plugin-react-i18next';

export const pageQuery = graphql`
  query RiversPageQuery($language: String!) {
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
    rivers: allContentfulWaterway(
      filter: {node_locale: {eq: $language}, paddlingEnvironmentType: {slug: {eq: "fluss"}}}
      sort: {name: ASC}
    ) {
      nodes {
        name
        slug
      }
    }
  }
`;

const RiversListPage = ({ data }) => {

  const {t} = useTranslation();

  const rivers = data.rivers

  return (
    <Layout pageName="rivers">
      <Helmet>
        <title>{t(`Paddel Buch - Rivers`)}</title>
      </Helmet>

      <Container className="rivers-list">
        <h2><Trans>Rivers</Trans></h2>
        <table>
          <tbody>
            <tr>
              <th><Trans>Name</Trans></th>
            </tr>
            { rivers.nodes.map(river => {
              const {
                name,
                slug
              } = river;

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

export default RiversListPage;
