const api_protectedareatypes_en = {
  fileName: "api/protectedareatypes-en",
  query: `
    query {
      allContentfulProtectedAreaType(
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
      allContentfulProtectedAreaType: { nodes },
    },
  }) => nodes,
}

module.exports = api_protectedareatypes_en;