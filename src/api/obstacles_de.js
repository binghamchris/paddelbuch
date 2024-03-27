const api_obstacles_de = {
  fileName: "api/obstacles-de",
  query: `
    query {
      allContentfulObstacle(limit: 999, filter: {node_locale: {eq: "de"}}, sort: {slug: ASC}) {
        nodes {
          slug
          node_locale
          createdAt
          updatedAt
          name
          description {
            raw
          }
          geometry {
            internal {
              content
            }
          }
          isPortageNecessary
          isPortagePossible
          portageRoute {
            internal {
              content
            }
          }
          portageDistance
          portageDescription {
            raw
          }
          obstacleType {
            slug
          }
          waterway {
            slug
          }
          dataSourceType {
            slug
          }
          dataLicenseType {
            slug
          }
        }
      }
    }`,
  transformer: ({
    data: {
      allContentfulObstacle: { nodes },
    },
  }) => nodes,
}

module.exports = api_obstacles_de;