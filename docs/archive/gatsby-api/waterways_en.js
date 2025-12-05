const api_waterways_en = {
  fileName: "api/waterways-en",
  query: `
    query {
      allContentfulWaterway(
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
          length
          area
          geometry {
            internal {
              content
            }
          }
          paddlingEnvironmentType {
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
      allContentfulWaterway: { nodes },
    },
  }) => nodes,
}

module.exports = api_waterways_en;