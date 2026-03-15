# Custom Amplify Build Image

A custom Docker build image for the paddelbuch Amplify app that pre-packages Ruby 3.4.9, Node.js 22, and all project dependencies. This eliminates per-build installation of language runtimes and significantly reduces build times.

## Prerequisites

- **AWS CLI v2** — installed and configured ([install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- **Docker** — installed and running ([install guide](https://docs.docker.com/get-docker/))
- **AWS profile `paddelbuch-dev`** — configured in `~/.aws/config` with credentials that have permissions to manage CloudFormation, ECR, IAM, and Amplify resources in `eu-central-1`

Verify your setup:

```bash
aws sts get-caller-identity --profile paddelbuch-dev --region eu-central-1
docker info
```

## 1. Deploy the ECR Repository Stack

The ECR repository is provisioned via CloudFormation using the template at `infrastructure/custom-build-image.yaml`.

### First-time deployment

```bash
aws cloudformation deploy \
  --template-file infrastructure/custom-build-image.yaml \
  --stack-name custom-build-image \
  --profile paddelbuch-dev \
  --region eu-central-1
```

### Updating an existing stack

The same command works for updates. Add `--no-fail-on-empty-changeset` to avoid a non-zero exit code when nothing has changed:

```bash
aws cloudformation deploy \
  --template-file infrastructure/custom-build-image.yaml \
  --stack-name custom-build-image \
  --no-fail-on-empty-changeset \
  --profile paddelbuch-dev \
  --region eu-central-1
```

### Verify the stack

```bash
aws cloudformation describe-stacks \
  --stack-name custom-build-image \
  --profile paddelbuch-dev \
  --region eu-central-1 \
  --query "Stacks[0].Outputs"
```

This should return the `RepositoryUri` and `RepositoryArn` outputs.

## 2. Build and Push the Docker Image

A helper script handles ECR authentication, building, tagging, and pushing the image. Run it from the project root:

```bash
./infrastructure/build-and-push.sh
```

The script will:

1. Retrieve the ECR repository URI from the `custom-build-image` CloudFormation stack
2. Authenticate Docker with ECR using the `paddelbuch-dev` profile
3. Build the image from `infrastructure/Dockerfile` using the project root as the build context
4. Tag the image with both `latest` and a timestamp (`YYYYMMDDHHmmss`)
5. Push both tags to ECR

> **Note:** The first build takes several minutes because Ruby 3.4.9 is compiled from source. Subsequent builds are faster due to Docker layer caching.

## 3. Update the Amplify App Stack with the Custom Image

The Amplify app template (`deploy/frontend-deploy.yaml`) accepts a `CustomBuildImageUri` parameter. When provided, Amplify uses the custom image instead of its default build environment.

### Get the ECR repository URI

```bash
REPO_URI=$(aws cloudformation describe-stacks \
  --stack-name custom-build-image \
  --profile paddelbuch-dev \
  --region eu-central-1 \
  --query "Stacks[0].Outputs[?OutputKey=='RepositoryUri'].OutputValue" \
  --output text)

echo "$REPO_URI:latest"
```

### Deploy the Amplify stack with the custom image

Pass the image URI as a parameter override when deploying the Amplify stack. Include all other required parameters for your environment:

```bash
aws cloudformation deploy \
  --template-file deploy/frontend-deploy.yaml \
  --stack-name <your-amplify-stack-name> \
  --parameter-overrides \
    CustomBuildImageUri="$REPO_URI:latest" \
    <...other existing parameters...> \
  --capabilities CAPABILITY_IAM \
  --profile paddelbuch-dev \
  --region eu-central-1
```

> **Important:** The `--capabilities CAPABILITY_IAM` flag is required because the template creates an IAM service role and ECR pull policy when a custom image is configured.

### Revert to the default Amplify image

To stop using the custom image, deploy the stack with an empty `CustomBuildImageUri`:

```bash
aws cloudformation deploy \
  --template-file deploy/frontend-deploy.yaml \
  --stack-name <your-amplify-stack-name> \
  --parameter-overrides \
    CustomBuildImageUri="" \
    <...other existing parameters...> \
  --capabilities CAPABILITY_IAM \
  --profile paddelbuch-dev \
  --region eu-central-1
```

## 4. Verify the Build Works with the Custom Image

After updating the Amplify stack:

1. Trigger a new build in the Amplify console or push a commit to the connected branch
2. Open the build logs in the Amplify console
3. Confirm the build log shows the custom image being pulled (you should see the ECR image URI in the early build output)
4. Confirm the preBuild phase does **not** contain `rvm install` or `nvm install` commands
5. Confirm the build completes successfully and the site deploys correctly

You can also verify the Amplify app configuration via the CLI:

```bash
aws amplify get-app \
  --app-id <your-amplify-app-id> \
  --profile paddelbuch-dev \
  --region eu-central-1 \
  --query "app.customImage"
```

This should return the ECR image URI if the custom image is configured.

## 5. Updating the Image When Dependencies Change

Rebuild and push the image whenever `Gemfile.lock` or `package-lock.json` changes (e.g., after adding, removing, or updating gems or npm packages).

```bash
# From the project root
./infrastructure/build-and-push.sh
```

The next Amplify build will automatically pull the updated `latest` image.

### When to rebuild

| Change | Action needed |
|--------|--------------|
| `Gemfile.lock` updated | Rebuild and push |
| `package-lock.json` updated | Rebuild and push |
| `.ruby-version` changed | Update the Dockerfile Ruby version, then rebuild and push |
| Node.js major version changed | Update the Dockerfile Node.js version, then rebuild and push |
| System dependency added | Update the Dockerfile `dnf install` list, then rebuild and push |
| No dependency changes | No rebuild needed — the existing image is reused |

> **Tip:** Even without rebuilding, `bundle install` and `npm ci` still run during the Amplify build (defined in `amplify.yml`). This ensures lock file parity. The pre-installed dependencies in the image act as a warm cache, making these commands complete in seconds.
