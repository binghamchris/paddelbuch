const api_obstacletypes_de = {
  fileName: "api/obstacletypes-de",
  query: `
    query {
      allContentfulObstacleType(
        filter: {node_locale: {eq: "de"}}
        limit: 999
        sort: {slug: ASC}
      ) {
        nodes {
          slug
          node_locale
          createdAt
          updatedAt
          name
        }
      }
    }`,
  transformer: ({
    data: {
      allContentfulObstacleType: { nodes },
    },
  }) => nodes,
}

module.exports = api_obstacletypes_de;