const api_protectedareatypes_de = {
  fileName: "api/protectedareatypes-de",
  query: `
    query {
      allContentfulProtectedAreaType(
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
      allContentfulProtectedAreaType: { nodes },
    },
  }) => nodes,
}

module.exports = api_protectedareatypes_de;