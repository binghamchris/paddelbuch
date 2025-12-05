const api_protectedareas_en = {
  fileName: "api/protectedareas-en",
  query: `
    query {
      allContentfulProtectedArea(
        limit: 999
        filter: {node_locale: {eq: "en"}}
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

module.exports = api_protectedareas_en;