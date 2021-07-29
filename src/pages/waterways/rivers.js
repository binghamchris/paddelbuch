import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "gatsby";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql, useStaticQuery } from "gatsby"

const SecondPage = () => {

  const { rivers } = useStaticQuery(graphql`
    query {
      rivers: allGraphCmsWaterway(
        filter: {locale: {eq: en}, paddlingEnvironments: {slug: {eq: "fluss"}}}
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
    <Layout pageName="rivers">
      <Helmet>
        <title>Swiss Paddel Buch - Rivers</title>
      </Helmet>

      <Container className="rivers-list">
        <h2>Rivers</h2>
        <table>
          <tbody>
            <tr>
              <th>Name</th>
            </tr>
            { rivers.nodes.map(river => {
              const {
                name,
                slug
              } = river;

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

export default SecondPage;
