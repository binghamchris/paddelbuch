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
    "gatsby-plugin-react-leaflet",
    {
      resolve: "gatsby-plugin-manifest",
      options: {
        name: siteMetadata.companyName,
        short_name: siteMetadata.companyName,
        start_url: "/",
        icon: "src/assets/images/logo-dark.svg",
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
          {userAgent: 'CCbot', disallow: '/'},
          {userAgent: 'GPTBot', disallow: '/'},
          {userAgent: 'ChatGPT-User', disallow: '/'},
          {userAgent: 'Google-Extended', disallow: '/'},
          {userAgent: 'GoogleOther', disallow: '/'}
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
        ]
      }
    },
  ],
};

