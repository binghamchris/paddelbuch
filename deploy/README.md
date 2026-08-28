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

## DNS: environment subdomain zones

`dns.yaml` creates the Route 53 hosted zone for an environment's subdomain — currently
`dev.paddelbuch.ch` in the dev account. The apex `paddelbuch.ch` zone lives in the
**production** account and is not managed by this template.

It is a separate stack from `frontend-deploy.yaml` on purpose. A hosted zone's four
nameservers are assigned by AWS at creation and cannot be chosen; the parent zone
delegates to those exact values. If the zone were destroyed and recreated it would come
back with **different** nameservers and the delegation would silently stop resolving —
no error anywhere, because the parent still points confidently at servers that no longer
host the zone. Keeping the zone out of the frequently-changing Amplify stack, with
`DeletionPolicy: Retain`, is what prevents that.

### Deploy

```bash
aws cloudformation deploy \
  --template-file dns.yaml \
  --stack-name paddelbuch-dns \
  --no-fail-on-empty-changeset \
  --profile paddelbuch-dev --region eu-central-1 \
  --parameter-overrides HostedZoneName=dev.paddelbuch.ch EnvironmentName=dev
```

### Creating the zone is not enough — the parent must delegate to it

**Until an `NS` record for the subdomain exists in the parent zone, nothing under
`dev.paddelbuch.ch` resolves anywhere on the internet.** The zone accepts records and
looks healthy in the console, but no resolver on earth can find it.

The practical consequence: an ACM certificate for `search.dev.paddelbuch.ch` validated by
DNS will sit in `PENDING_VALIDATION` indefinitely, because ACM resolves the validation
record through the public DNS hierarchy rather than by reading the zone directly. That is
the failure this section exists to prevent, since it presents as "ACM is broken" rather
than "DNS is not delegated".

The delegation is a **cross-account, production** change: the apex `paddelbuch.ch` zone
lives in the production account. `dns-delegation.yaml` performs it as IaC rather than a
console or CLI edit.

```bash
# 1. Read the dev zone's nameservers from its stack. Never copy them from
#    documentation -- a zone recreation changes them.
NS=$(aws cloudformation describe-stacks --stack-name paddelbuch-dns \
  --profile paddelbuch-dev --region eu-central-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`NameServers`].OutputValue' --output text)

# 2. Deploy the delegation into the PRODUCTION account.
aws cloudformation deploy \
  --template-file dns-delegation.yaml \
  --stack-name paddelbuch-dns-delegation \
  --no-fail-on-empty-changeset \
  --profile paddelbuch-prod --region eu-central-1 \
  --parameter-overrides \
    ParentHostedZoneId=Z0408920ISG62DD5PPEU \
    SubdomainName=dev.paddelbuch.ch \
    "SubdomainNameServers=${NS// /}"
```

The apex zone carries the live site's `A` record, the `www` CNAME and the whole email
chain (`MX`, SPF, `_dmarc`, and DKIM CNAMEs for Google and ProtonMail). Preview with a
change set before executing and confirm it reports exactly **one** `Add` of an
`AWS::Route53::RecordSet` — CloudFormation only manages what it declares, so a stack
holding one record cannot disturb the rest, but the preview is cheap and the zone carries
mail.

#### Verifying it — and the trap that makes it look broken

`dig +short NS dev.paddelbuch.ch` is **not** a reliable check, and will very likely tell
you the delegation failed when it has not:

- A delegating nameserver returns NS records in the **authority** section as a referral,
  which `+short` does not print.
- Worse, if you queried the name *before* the delegation existed, your resolver cached the
  `NXDOMAIN`. The parent zone's SOA sets a negative-cache TTL of **86400**, so that false
  negative can persist for a day.

Both happened when this was first deployed: local `dig` reported `NXDOMAIN` from an
authoritative server while the record was demonstrably present in the zone.

Check against a public resolver over DoH instead, which bypasses the local cache:

```bash
curl -s -H 'accept: application/dns-json' \
  'https://cloudflare-dns.com/dns-query?name=dev.paddelbuch.ch&type=NS'
```

`"Status": 0` with four `Answer` entries means the delegation is live. Confirm the child
zone is actually reachable through it by asking for the `SOA` the same way.

Recorded for the record: dev zone `Z0319173110CBU9A6YYE1` delegated from apex zone
`Z0408920ISG62DD5PPEU` on 2026-08-28, to `ns-1727.awsdns-23.co.uk`,
`ns-373.awsdns-46.com`, `ns-1043.awsdns-02.org`, `ns-866.awsdns-44.net`.

### Consuming the zone from other stacks

The zone ID and name are published to SSM Parameter Store:

| parameter | value |
|---|---|
| `/paddelbuch/dev/dns/hosted-zone-id` | the zone ID |
| `/paddelbuch/dev/dns/hosted-zone-name` | `dev.paddelbuch.ch` |

SSM rather than a CloudFormation `Export`, deliberately. An export creates a hard
dependency: while another stack imports the value, this stack cannot be updated in any way
that changes it and cannot be deleted at all. That is the wrong coupling for a
foundational resource read by stacks in a different repository — the search API's custom
domain being the first of them. Standard SSM parameters are free.

### Cost

**$0.50/month per hosted zone**, plus $0.40 per million DNS queries. Worth stating
plainly: that is roughly four times the search backend's entire running cost (~$0.12/month)
and 2.5% of the $20 monthly budget. `DeletionPolicy: Retain` means deleting the stack does
**not** stop the charge — the zone must be removed deliberately.

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
   - Install npm dependencies (`npm ci`)
   - Download and self-host Google Fonts (`npm run download-fonts`)
   - Copy vendor assets from node_modules (`npm run copy-assets`)
   - Install Ruby gem dependencies (`bundle install`)

2. **build Phase**:
   - Execute `bundle exec rake build:site` (parallel locale build pipeline)
   - Run JavaScript tests (`npm test`)

3. **artifacts**:
   - Output directory: `_site`
   - All files are deployed to CloudFront

A custom Docker build image (see [docs/custom-amplify-build-image/README.md](../docs/custom-amplify-build-image/README.md)) pre-packages Ruby 3.4.9 and Node.js 22 to speed up builds.

## Cache Configuration

Different content types have different cache TTLs (configured in the CloudFormation template's `CustomHeaders`):

| Content Type | Pattern | TTL | Rationale |
|--------------|---------|-----|-----------|
| HTML pages | `*.html` | 1 day | Content changes infrequently |
| Spatial tiles | `/api/tiles/**/*.json` | 7 days | Only changes on rebuild |
| API JSON | `/api/*.json` | 1 day | Balance freshness/performance |
| Static assets | `/assets/**/*` | 30 days | Immutable |
| Default | `**/*` | 6 hours | General content |

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