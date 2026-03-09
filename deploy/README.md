# Deployment Documentation

This directory contains the AWS CloudFormation files used to deploy and manage the Paddel Buch frontend on AWS Amplify in the `eu-central-1` region.

## Architecture

Paddel Buch is deployed as a static Jekyll site on AWS Amplify with the following components:
- **AWS Amplify App**: Hosts the static site with CI/CD
- **CloudFront CDN**: Serves content from edge locations
- **Custom Domain**: Configured with SSL certificate

## Environment Variables

The following environment variables must be configured in AWS Amplify:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CONTENTFUL_SPACE_ID` | Contentful space identifier | `abc123xyz` |
| `CONTENTFUL_ACCESS_TOKEN` | Contentful Delivery API token | `CFPAT-xxxxx` |
| `CONTENTFUL_ENVIRONMENT` | Contentful environment (master/preview) | `master` |
| `MAPBOX_URL` | Mapbox tile URL with access token | `https://api.mapbox.com/styles/v1/...` |
| `SITE_URL` | Production site URL | `https://www.paddelbuch.ch` |

### Setting Environment Variables

Environment variables can be set in two ways:

1. **Via CloudFormation**: Pass values as parameters when deploying the stack
2. **Via Amplify Console**: Navigate to App Settings > Environment Variables

## CloudFormation Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- GitHub personal access token with repo access

### Deploy Command

```bash
aws cloudformation deploy \
  --template-file frontend-deploy.yaml \
  --stack-name paddelbuch-frontend \
  --region eu-central-1 \
  --profile <your-profile>-dev \
  --parameter-overrides \
    AppName=paddelbuch \
    AppDomainName=paddelbuch.ch \
    AppDescription="Swiss Paddle Sports Map" \
    AppStage=PRODUCTION \
    EnvVarMapboxUrl="<mapbox-url>" \
    EnvVarContentfulToken="<contentful-token>" \
    EnvVarContentfulSpace="<contentful-space-id>" \
    EnvVarContentfulEnv="master" \
    EnvVarSiteUrl="https://www.paddelbuch.ch" \
    GithubRepoUrl="https://github.com/<org>/<repo>" \
    GithubBranchName="main" \
    GithubToken="<github-token>"
```

## Build Process

The site is built using Jekyll with the following process (defined in `amplify.yml`):

1. **preBuild Phase**:
   - Install Ruby 3.3.0 via rbenv
   - Install bundler and project gems
   - Install Node.js dependencies for testing

2. **build Phase**:
   - Execute `bundle exec jekyll build`
   - Run tests (optional)

3. **artifacts**:
   - Output directory: `_site`
   - All files are deployed to CloudFront

## Cache Configuration

Different content types have different cache TTLs:

| Content Type | Pattern | TTL | Rationale |
|--------------|---------|-----|-----------|
| HTML pages | `*.html` | 5 minutes | Content freshness |
| Spatial tiles | `/api/tiles/**/*.json` | 7 days | Only changes on rebuild |
| API JSON | `/api/*.json` | 6 hours | Balance freshness/performance |
| Static assets | `/assets/**/*` | 30 days | Versioned, immutable |
| Default | `*` | 6 hours | General content |

## Contentful Webhook Setup

To enable automatic rebuilds when content is published in Contentful:

1. Navigate to Contentful > Settings > Webhooks
2. Create a new webhook with the following settings:
   - **Name**: `Amplify Rebuild - Production`
   - **URL**: `https://webhooks.amplify.eu-central-1.amazonaws.com/prod/webhooks?...`
   - **Triggers**: Select "Publish" and "Unpublish" for Entry and Asset
   - **Filters**: Optionally filter by content type

### Getting the Webhook URL

1. Open AWS Amplify Console
2. Navigate to your app > Build settings > Build notifications
3. Copy the webhook URL for your branch

### Webhook Payload

Contentful will send a POST request with content change details. Amplify will trigger a new build automatically.

## Branch Strategy

| Branch | Environment | URL |
|--------|-------------|-----|
| `main` | Production | https://www.paddelbuch.ch |
| `develop` | Preview | https://develop.paddelbuch.ch |
| Feature branches | Preview | https://{branch}.paddelbuch.ch |

## Troubleshooting

### Build Failures

1. Check Amplify Console > Build logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure Ruby version matches `.ruby-version` file

### Content Not Updating

1. Verify Contentful webhook is configured and active
2. Check webhook delivery logs in Contentful
3. Manually trigger a build in Amplify Console if needed

### Cache Issues

1. Invalidate CloudFront cache via Amplify Console
2. Check browser developer tools for cache headers
3. Use cache-busting query parameters for testing