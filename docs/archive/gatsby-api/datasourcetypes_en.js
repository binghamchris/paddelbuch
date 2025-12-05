const api_datasourcetypes_en = {
  fileName: "api/datasourcetypes-en",
  query: `
    query {
      allContentfulDataSourceType(
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
      allContentfulDataSourceType: { nodes },
    },
  }) => nodes,
}

module.exports = api_datasourcetypes_en;