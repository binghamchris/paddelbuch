import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "gatsby";
import Layout from "components/Layout";
import Container from "components/Container";
import { graphql, useStaticQuery } from "gatsby"

const ToursListPage = () => {

  const { tours } = useStaticQuery(graphql`
    query {
      tours: allGraphCmsTour(filter: {locale: {eq: en}}) {
        nodes {
          id
          slug
          name
          description {
            html
          }
          oneWayDistance
          paddlingTimeOneWayCanoe
          paddlingTimeOneWayKayak
          paddlingTimeOneWaySup
          paddlingEnvironments {
            name
            id
          }
          waterways {
            name
            id
          }
        }
      }
    }
  `)

  return (
    <Layout pageName="tours">
      <Helmet>
        <title>Swiss Paddel Buch - Tours</title>
      </Helmet>

      <Container className="tour-list">
        <h2>Tours</h2>
        <table>
          <tbody>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>One Way Distance</th>
              <th>Paddling Time (Kayak)</th>
              <th>Paddling Time Canoe</th>
              <th>Paddling Time SUP</th>
              <th>Round Trip Possible</th>
              <th>Waterway</th>
              <th>Paddling Environment</th>
            </tr>
            { tours.nodes.map(tours => {
              const {
                slug,
                oneWayDistance,
                paddlingTimeOneWayKayak,
                paddlingTimeOneWayCanoe,
                paddlingTimeOneWaySup,
                roundTripPossible,
                name,
                description,
                waterways,
                paddlingEnvironments
              } = tours;
              return <tr>
                      <td>
                        <Link to={`/tours/${slug}`}>
                          {name}
                        </Link>
                      </td>
                      <td>
                        {description}
                      </td>
                      <td>
                        {oneWayDistance}
                      </td>
                      <td>
                        {paddlingTimeOneWayKayak} hours
                      </td>
                      <td>
                        {paddlingTimeOneWayCanoe} hours
                      </td>
                      <td>
                        {paddlingTimeOneWaySup} hours
                      </td>
                      <td>
                        {roundTripPossible? 'Yes':'No'}
                      </td>
                      <td>
                        {waterways.name}
                      </td>
                      <td>
                        {paddlingEnvironments.name}
                      </td>
                    </tr> 
            })}
          </tbody>
        </table>
      </Container>
    </Layout>
  );
};

export default ToursListPage;
