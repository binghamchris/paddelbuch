const api_datalicensetypes_de = {
  fileName: "api/datalicensetypes-de",
  query: `
    query {
      allContentfulDataLicenseType(
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
          summaryUrl
          fullTextUrl
        }
      }
    }`,
  transformer: ({
    data: {
      allContentfulDataLicenseType: { nodes },
    },
  }) => nodes,
}

module.exports = api_datalicensetypes_de;