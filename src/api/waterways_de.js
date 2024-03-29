const api_waterways_de = {
  fileName: "api/waterways-de",
  query: `
    query {
      allContentfulWaterway(
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
          country
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

module.exports = api_waterways_de;