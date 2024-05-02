const api_lastUpdateIndex = {
  fileName: "api/lastUpdateIndex",
  query: `
    query {
      lastUpdateSpot: allContentfulSpot(sort: {updatedAt: DESC}, limit: 1) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdateObstacle: allContentfulObstacle(sort: {updatedAt: DESC}, limit: 1) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdateWaterwayEvent: allContentfulWaterwayEventNotice(
        sort: {updatedAt: DESC}
        limit: 1
      ) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdateProtectedArea: allContentfulProtectedArea(
        sort: {updatedAt: DESC}
        limit: 1
      ) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdateWaterway: allContentfulWaterway(sort: {updatedAt: DESC}, limit: 1) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdateDataLicense: allContentfulDataLicenseType(
        sort: {updatedAt: DESC}
        limit: 1
      ) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdateDataSource: allContentfulDataSourceType(
        sort: {updatedAt: DESC}
        limit: 1
      ) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdateObstacleType: allContentfulObstacleType(
        sort: {updatedAt: DESC}
        limit: 1
      ) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdatePaddleCraftType: allContentfulPaddleCraftType(
        sort: {updatedAt: DESC}
        limit: 1
      ) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdateProtectedAreaType: allContentfulProtectedAreaType(
        sort: {updatedAt: DESC}
        limit: 1
      ) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdateSpotType: allContentfulSpotType(sort: {updatedAt: DESC}, limit: 1) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
      lastUpdatePaddlingEnvironmentType: allContentfulPaddlingEnvironmentType(
        sort: {updatedAt: DESC}
        limit: 1
      ) {
        nodes {
          updatedAt
          sys {
            contentType {
              sys {
                id
              }
            }
          }
        }
      }
    }
  `,
  transformer: (
    inputJson
  ) => {
    var output = [];
    for(var table in inputJson['data']){
      tableName = inputJson['data'][table]['nodes'][0]['sys']['contentType']['sys']['id'];
      lastUpdate = inputJson['data'][table]['nodes'][0]['updatedAt'];
      output.push({"table": `${tableName}s`, "lastUpdatedAt": lastUpdate})
    }
    return(output);
  },
}

module.exports = api_lastUpdateIndex;