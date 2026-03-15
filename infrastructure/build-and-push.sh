#!/usr/bin/env bash
set -euo pipefail

PROFILE=paddelbuch-dev
REGION=us-east-1
STACK_NAME=paddelbuch-custom-build-image
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Get ECR Public repository URI from CloudFormation output (us-east-1)
REPO_URI=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='RepositoryUri'].OutputValue" \
  --output text)

if [[ -z "$REPO_URI" || "$REPO_URI" == "None" ]]; then
  echo "Error: Could not retrieve ECR Public repository URI from stack '$STACK_NAME'." >&2
  exit 1
fi

echo "ECR Public Repository URI: $REPO_URI"

# Authenticate Docker with ECR Public
aws ecr-public get-login-password \
  --profile "$PROFILE" \
  --region "$REGION" \
| docker login --username AWS --password-stdin public.ecr.aws

# Build Docker image
echo "Building Docker image..."
docker build --platform linux/amd64 -t "$REPO_URI:latest" -f infrastructure/Dockerfile .

# Tag with timestamp
docker tag "$REPO_URI:latest" "$REPO_URI:$TIMESTAMP"

# Push both tags
echo "Pushing $REPO_URI:latest..."
docker push "$REPO_URI:latest"

echo "Pushing $REPO_URI:$TIMESTAMP..."
docker push "$REPO_URI:$TIMESTAMP"

echo "Done. Image pushed with tags: latest, $TIMESTAMP"
