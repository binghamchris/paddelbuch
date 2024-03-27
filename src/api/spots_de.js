const api_spots_de = {
  fileName: "api/spots-de",
  query: `
    query {
      allContentfulSpot(limit: 999, filter: {rejected: {ne: true}, node_locale: {eq: "de"}}, sort: {slug: ASC}) {
        nodes {
          slug
          node_locale
          createdAt
          updatedAt
          name
          description {
            raw
          }
          location {
            lat
            lon
          }
          approximateAddress {
            approximateAddress
          }
          country
          confirmed
          rejected
          waterway {
            slug
          }
          spotType {
            slug
          }
          paddlingEnvironmentType {
            slug
          }
          paddleCraftType {
            slug
          }
          waterway_event_notice {
            slug
            startDate
            endDate
          }
          obstacle {
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
      allContentfulSpot: { nodes },
    },
  }) => nodes,
}

module.exports = api_spots_de;