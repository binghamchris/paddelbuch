require("dotenv").config({
  path: `.env.${process.env.NODE_ENV}`,
})

const config = require("./package.json"); 

const { description, homepage } = config;

const siteMetadata = {
  companyName: "Swiss Paddel Buch",
  authorName: "Chris Bingham",
  siteUrl: homepage,
  siteDescription: description,
};

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
        icon: "src/assets/images/logo.png",
      },
    },
    {
      resolve: "gatsby-source-graphcms",
      options: {
        endpoint: "https://api-eu-central-1.graphcms.com/v2/ckq3v9412ku0401w70mgs10qp/master",
        locales: ['en', 'de'],
        token: process.env.GCMS_TOKEN,
      }
    },
    {
      resolve: `gatsby-plugin-gatsby-cloud`,
      options: {
        mergeSecurityHeaders: false,
        mergeCachingHeaders: true,
        mergeLinkHeaders: true,
        allPageHeaders: [
          "X-Frame-Options: DENY",
          "X-XSS-Protection: 1; mode=block",
          "X-Content-Type-Options: nosniff",
          "Referrer-Policy: strict-origin-when-cross-origin",
          "Content-Security-Policy: default-src 'self'; img-src 'self' data: raw.githubusercontent.com api.mapbox.com; style-src 'self' 'unsafe-inline' unpkg.com; script-src 'self' 'unsafe-inline'; font-src 'self' 'unsafe-inline'"
        ]
      }
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/src/locales`,
        name: `locale`
      }
    },
    {
      resolve: `gatsby-plugin-react-i18next`,
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
    `gatsby-plugin-image`,
    `gatsby-plugin-sharp`
  ],
};

