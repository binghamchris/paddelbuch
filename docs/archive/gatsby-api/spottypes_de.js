const api_spottypes_de = {
  fileName: "api/spottypes-de",
  query: `
    query {
      allContentfulSpotType(
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
      allContentfulSpotType: { nodes },
    },
  }) => nodes,
}

module.exports = api_spottypes_de;