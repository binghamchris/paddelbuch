const api_protectedareas_de = {
  fileName: "api/protectedareas-de",
  query: `
    query {
      allContentfulProtectedArea(
        limit: 999
        filter: {node_locale: {eq: "de"}}
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
          geometry {
            internal {
              content
            }
          }
          isAreaMarked
          protectedAreaType {
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
      allContentfulProtectedArea: { nodes },
    },
  }) => nodes,
}

module.exports = api_protectedareas_de;