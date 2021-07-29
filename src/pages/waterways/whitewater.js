import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "gatsby";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql, useStaticQuery } from "gatsby"

const SecondPage = () => {

  const { whitewater } = useStaticQuery(graphql`
    query {
      whitewater: allGraphCmsWaterway(
        filter: {locale: {eq: en}, paddlingEnvironments: {slug: {eq: "wildwasser"}}}
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
    <Layout pageName="whitewater">
      <Helmet>
        <title>Swiss Paddel Buch - Whitewater</title>
      </Helmet>

      <Container className="whitewater-list">
        <h2>Whitewater</h2>
        <table>
          <tbody>
            <tr>
              <th>Name</th>
            </tr>
            { whitewater.nodes.map(whitewater => {
              const {
                name,
                slug
              } = whitewater;

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
