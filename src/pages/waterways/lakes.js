import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "gatsby";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql, useStaticQuery } from "gatsby"

const LakesListPage = () => {

  const { lakes } = useStaticQuery(graphql`
    query {
      lakes: allGraphCmsWaterway(
        filter: {locale: {eq: en}, paddlingEnvironments: {slug: {eq: "see"}}}
        sort: {fields: name}
      ) {
        nodes {
          name
          slug
        }
      }
    }
  `)

  return (
    <Layout pageName="lakes">
      <Helmet>
        <title>Swiss Paddel Buch - Lakes</title>
      </Helmet>

      <Container className="lakes-list">
        <h2>Lakes</h2>
        <table>
          <tbody>
            <tr>
              <th>Name</th>
            </tr>
            { lakes.nodes.map(lakes => {
              const {
                name,
                slug
              } = lakes;

              return <tr>
                      <td>
                        <Link to={`/waterways/${slug}`}>
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
