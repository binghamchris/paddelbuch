import React from "react";
import { Helmet } from "react-helmet";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql } from "gatsby";
import { Link, Trans, useTranslation } from 'gatsby-plugin-react-i18next';

export const pageQuery = graphql`
  query WhitewaterPageQuery($language: GraphCMS_Locale!) {
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
    whitewater: allGraphCmsWaterway(
      filter: {locale: {eq: $language}, paddlingEnvironments: {slug: {eq: "wildwasser"}}}
      sort: {fields: name}
    ) {
      nodes {
        name
        slug
      }
    }
  }
`;

const WhitewaterListPage = ({ data }) => {

  const {t} = useTranslation();

  const whitewater = data.whitewater

  return (
    <Layout pageName="whitewater">
      <Helmet>
        <title>{t(`Swiss Paddel Buch - Whitewater`)}</title>
      </Helmet>

      <Container className="whitewater-list">
        <h2><Trans>Whitewater</Trans></h2>
        <table>
          <tbody>
            <tr>
              <th><Trans>Name</Trans></th>
            </tr>
            { whitewater.nodes.map(whitewater => {
              const {
                name,
                slug
              } = whitewater;

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

export default WhitewaterListPage;
