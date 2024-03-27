const api_waterwayevents_en = {
  fileName: "api/waterwayevents-en",
  query: `
    query {
      allContentfulWaterwayEventNotice(limit: 999, filter: {node_locale: {eq: "en"}}, sort: {slug: ASC}) {
        nodes {
          slug
          node_locale
          createdAt
          updatedAt
          name
          startDate
          endDate
          description {
            raw
          }
          spot {
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
      allContentfulWaterwayEventNotice: { nodes },
    },
  }) => nodes,
}

module.exports = api_waterwayevents_en;