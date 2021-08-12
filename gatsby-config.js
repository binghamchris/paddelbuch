require("dotenv").config({
  path: `.env.${process.env.NODE_ENV}`,
})

const config = require("./package.json"); 

const { title, description, author, repository, homepage } = config;

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
        icon: "src/assets/images/react-leaflet-icon.png",
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
    "gatsby-plugin-gatsby-cloud",
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
    }
  ],
};

