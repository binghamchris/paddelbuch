const api_paddlingenvironmenttypes_en = {
  fileName: "api/paddlingenvironmenttypes-en",
  query: `
    query {
      allContentfulPaddlingEnvironmentType(
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
      allContentfulPaddlingEnvironmentType: { nodes },
    },
  }) => nodes,
}

module.exports = api_paddlingenvironmenttypes_en;