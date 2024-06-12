require("dotenv").config({
  path: `.env.${process.env.NODE_ENV}`,
})

const config = require("./package.json"); 

const { description } = config;

const siteMetadata = {
  companyName: "Paddel Buch",
  authorName: "Chris Bingham",
  siteUrl: "https://www.paddelbuch.ch",
  siteDescription: description,
};

const api_spots_en = require("./src/api/spots_en");
const api_spots_de = require("./src/api/spots_de");
const api_obstacles_en = require("./src/api/obstacles_en");
const api_obstacles_de = require("./src/api/obstacles_de");
const api_waterwayevents_en = require("./src/api/waterwayevents_en");
const api_waterwayevents_de = require("./src/api/waterwayevents_de");
const api_protectedareas_en = require("./src/api/protectedareas_en");
const api_protectedareas_de = require("./src/api/protectedareas_de");
const api_waterways_en = require("./src/api/waterways_en");
const api_waterways_de = require("./src/api/waterways_de");
const api_datalicensetypes_en = require("./src/api/datalicensetypes_en");
const api_datalicensetypes_de = require("./src/api/datalicensetypes_de");
const api_datasourcetypes_en = require("./src/api/datasourcetypes_en");
const api_datasourcetypes_de = require("./src/api/datasourcetypes_de");
const api_obstacletypes_en = require("./src/api/obstacletypes_en");
const api_obstacletypes_de = require("./src/api/obstacletypes_de");
const api_paddlecrafttypes_en = require("./src/api/paddlecrafttypes_en");
const api_paddlecrafttypes_de = require("./src/api/paddlecrafttypes_de");
const api_protectedareatypes_en = require("./src/api/protectedareatypes_en");
const api_protectedareatypes_de = require("./src/api/protectedareatypes_de");
const api_spottypes_en = require("./src/api/spottypes_en");
const api_spottypes_de = require("./src/api/spottypes_de");
const api_paddlingenvironmenttypes_en = require("./src/api/paddlingenvironmenttypes_en");
const api_paddlingenvironmenttypes_de = require("./src/api/paddlingenvironmenttypes_de");
const api_lastUpdateIndex = require("./src/api/lastUpdateIndex");

module.exports = {
  siteMetadata,
  plugins: [
    "gatsby-plugin-resolve-src",
    {
      resolve: "gatsby-plugin-sass",
      options: {
        implementation: require("sass"),
      },
    },
    "gatsby-plugin-react-helmet",
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `images`,
        path: `${__dirname}/src/assets/images`,
      },
    },
    "@binghamchris/gatsby-plugin-react-leaflet",
    {
      resolve: "gatsby-plugin-manifest",
      options: {
        name: siteMetadata.companyName,
        short_name: siteMetadata.companyName,
        start_url: "/",
        icon: "src/assets/images/logo-favicon.svg",
        icon_options: {
          purpose: `any maskable`,
        },
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/src/locales`,
        name: `locale`
      }
    },
    {
      resolve: `@herob191/gatsby-plugin-react-i18next`,
      options: {
        localeJsonSourceName: `locale`,
        languages: ['en', 'de'],
        defaultLanguage: 'de',
        siteUrl: process.env.SITE_URL,
        redirect: true,
        i18nextOptions: {
          interpolation: {
            escapeValue: false 
          },
          keySeparator: false,
          nsSeparator: false
        }
      }
    },
    {
      resolve: 'gatsby-plugin-robots-txt',
      options: {
        policy: [
          /** AI training scrapers */
          {userAgent: 'CCbot', disallow: '/'},
          {userAgent: 'GPTBot', disallow: '/'},
          {userAgent: 'ChatGPT-User', disallow: '/'},
          {userAgent: 'Google-Extended', disallow: '/'},
          {userAgent: 'anthropic-ai', disallow: '/'},
          {userAgent: 'Claude-Web', disallow: '/'},
          {userAgent: 'FacebookBot', disallow: '/'},
          {userAgent: 'PiplBot', disallow: '/'},
          {userAgent: 'cohere-ai', disallow: '/'},
          {userAgent: 'Omgilibot', disallow: '/'},
          {userAgent: 'Amazonbot', disallow: '/'},
          {userAgent: 'PerplexityBot', disallow: '/'},
          {userAgent: 'Omgili', disallow: '/'},
          {userAgent: 'Diffbot', disallow: '/'},
          {userAgent: 'Bytespider', disallow: '/'},
          {userAgent: 'ImagesiftBot', disallow: '/'},
          {userAgent: 'Applebot-Extended', disallow: '/'},
          {userAgent: 'YouBot', disallow: '/'},
          {userAgent: 'Twitterbot', disallow: '/'},
          /** Google research bot */
          {userAgent: 'GoogleOther', disallow: '/'},
          /** Bad bots */
          {userAgent: 'AhrefsBot', disallow: '/'},
          {userAgent: 'PetalBot', disallow: '/'},
          {userAgent: 'SEMrushBot', disallow: '/'},
          {userAgent: 'Majestic', disallow: '/'},
          {userAgent: 'DotBot', disallow: '/'},
          {userAgent: 'niki-bot', disallow: '/'},
          /** Other content scrapers */
          {userAgent: 'TurnitinBot', disallow: '/'},
          {userAgent: 'PetalBot', disallow: '/'},
          {userAgent: 'MoodleBot', disallow: '/'},
        ]
      }
    },
    `gatsby-plugin-image`,
    `gatsby-plugin-sharp`,
    "gatsby-plugin-sitemap",
    {
      resolve: `gatsby-source-contentful`,
      options: {
        spaceId: process.env.CONTENTFUL_SPACE_ID,
        accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
        environment: process.env.CONTENTFUL_ENVIRONMENT
      },
    },
    {
      resolve: "gatsby-plugin-json-pages",
      options: {
        pages: [
          api_lastUpdateIndex,
          api_spots_en,
          api_spots_de,
          api_obstacles_en,
          api_obstacles_de,
          api_waterwayevents_en,
          api_waterwayevents_de,
          api_protectedareas_en,
          api_protectedareas_de,
          api_waterways_en,
          api_waterways_de,
          api_datalicensetypes_en,
          api_datalicensetypes_de,
          api_datasourcetypes_en,
          api_datasourcetypes_de,
          api_obstacletypes_en,
          api_obstacletypes_de,
          api_paddlecrafttypes_en,
          api_paddlecrafttypes_de,
          api_protectedareatypes_en,
          api_protectedareatypes_de,
          api_spottypes_en,
          api_spottypes_de,
          api_paddlingenvironmenttypes_en,
          api_paddlingenvironmenttypes_de,
        ]
      }
    },
  ],
};

