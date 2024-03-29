const api_spottypes_en = {
  fileName: "api/spottypes-en",
  query: `
    query {
      allContentfulSpotType(
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
      allContentfulSpotType: { nodes },
    },
  }) => nodes,
}

module.exports = api_spottypes_en;