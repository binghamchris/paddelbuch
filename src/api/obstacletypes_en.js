const api_obstacletypes_en = {
  fileName: "api/obstacletypes-en",
  query: `
    query {
      allContentfulObstacleType(
        filter: {node_locale: {eq: "en"}}
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

module.exports = api_obstacletypes_en;