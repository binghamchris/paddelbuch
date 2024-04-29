const api_paddlingenvironmenttypes_de = {
  fileName: "api/paddlingenvironmenttypes-de",
  query: `
    query {
      allContentfulPaddlingEnvironmentType(
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
      allContentfulPaddlingEnvironmentType: { nodes },
    },
  }) => nodes,
}

module.exports = api_paddlingenvironmenttypes_de;