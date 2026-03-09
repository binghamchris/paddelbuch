const api_paddlecrafttypes_en = {
  fileName: "api/paddlecrafttypes-en",
  query: `
    query {
      allContentfulPaddleCraftType(
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

module.exports = api_paddlecrafttypes_en;