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
    {
      resolve: 'gatsby-plugin-robots-txt',
      options: {
        policy: [
          {userAgent: 'CCbot', disallow: '/'},
          {userAgent: 'GBTBot', disallow: '/'},
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
        spaceId: `mwuqd55n7yfb`,
        accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
        environment: 'dev',
        downloadLocal: true
      },
    },
  ],
};

