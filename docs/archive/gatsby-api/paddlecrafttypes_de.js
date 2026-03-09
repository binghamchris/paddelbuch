const api_paddlecrafttypes_de = {
  fileName: "api/paddlecrafttypes-de",
  query: `
    query {
      allContentfulPaddleCraftType(
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
          description {
            raw
          }
        }
      }
    }`,
  transformer: ({
    data: {
      allContentfulPaddleCraftType: { nodes },
    },
  }) => nodes,
}

module.exports = api_paddlecrafttypes_de;