# Implementation Plan: Custom Amplify Build Image

## Overview

Create a custom Docker build image for the paddelbuch Amplify app that pre-packages Ruby 3.4.9, Node.js 22, and all project dependencies. Provision the ECR Public repository via CloudFormation (us-east-1), update the Amplify template to use the custom image from public.ecr.aws, simplify amplify.yml, and automate the build-and-push workflow with a shell script.

## Tasks

- [x] 1. Create ECR Public CloudFormation template and infrastructure directory
  - [x] 1.1 Create `infrastructure/custom-build-image.yaml` with ECR Public repository resource
    - Define `AWS::ECR::PublicRepository` with catalog data description
    - Template must be deployed to us-east-1 (ECR Public API region)
    - Add `RepositoryUri` output (public.ecr.aws format)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Write unit tests for ECR Public CloudFormation template
    - Parse `infrastructure/custom-build-image.yaml` and assert ECR Public resource type (`AWS::ECR::PublicRepository`), catalog data, and outputs
    - Test file: `_tests/unit/custom-build-image-ecr.test.js`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Create the Dockerfile
  - [x] 2.1 Create `infrastructure/Dockerfile` with Amazon Linux 2023 base and system dependencies
    - Use `amazonlinux:2023` base image
    - Install build-essential packages: gcc, gcc-c++, make, autoconf, bison, openssl-devel, readline-devel, zlib-devel, libyaml-devel, libffi-devel, gdbm-devel, tar, gzip, git, which, procps-ng
    - _Requirements: 2.1, 2.7_

  - [x] 2.2 Add Ruby 3.4.9 compilation from source to the Dockerfile
    - Download ruby-3.4.9.tar.gz from https://cache.ruby-lang.org
    - Configure with `--disable-install-doc`, compile with `make -j$(nproc)`, install
    - Verify with `ruby --version`
    - _Requirements: 2.2, 7.2_

  - [x] 2.3 Add Node.js 22 installation from official binary archive to the Dockerfile
    - Download node-v22.x.x-linux-x64.tar.xz from https://nodejs.org
    - Extract to /usr/local
    - Verify with `node --version && npm --version`
    - _Requirements: 2.3, 7.3_

  - [x] 2.4 Add dependency pre-installation and PATH setup to the Dockerfile
    - COPY Gemfile and Gemfile.lock, run `bundle install`
    - COPY package.json and package-lock.json, run `npm ci`
    - Set ENV PATH so Ruby and Node.js are available without activation steps
    - Set WORKDIR to /app
    - _Requirements: 2.4, 2.5, 2.6, 7.4, 7.5_

  - [x] 2.5 Write unit tests for Dockerfile structure
    - Parse `infrastructure/Dockerfile` and assert: FROM base image, Ruby source compilation, Node.js binary install, COPY instructions, bundle install, npm ci, PATH env
    - Test file: `_tests/unit/custom-build-image-dockerfile.test.js`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Create the build-and-push script
  - [x] 3.1 Create `infrastructure/build-and-push.sh`
    - Use `set -euo pipefail`
    - Authenticate with ECR Public using `aws ecr-public get-login-password` with `paddelbuch-dev` profile in `us-east-1`
    - Docker login to `public.ecr.aws`
    - Build Docker image with `-f infrastructure/Dockerfile .` (run from project root)
    - Tag with both `latest` and timestamp (`YYYYMMDDHHmmss`)
    - Push both tags to ECR Public (public.ecr.aws)
    - Make script executable
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Write unit tests for build-and-push script
    - Parse `infrastructure/build-and-push.sh` and assert: `set -euo pipefail`, paddelbuch-dev profile, us-east-1 region, `ecr-public get-login-password`, `public.ecr.aws` login, docker build/tag/push commands, latest + timestamp tags
    - Test file: `_tests/unit/custom-build-image-build-script.test.js`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Verify infrastructure files
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Update Amplify template for custom image support
  - [~] 5.1 Add `CustomBuildImageUri` parameter and `HasCustomImage` condition to `deploy/frontend-deploy.yaml`
    - New parameter `CustomBuildImageUri` (String, default empty)
    - New condition `HasCustomImage` that is true when parameter is non-empty
    - Set `_CUSTOM_IMAGE` environment variable on `PaddelBuchApp` to the ECR Public URI
    - No IAM service role or ECR pull policy needed (ECR Public is publicly accessible)
    - _Requirements: 4.1, 4.2, 4.3_

  - [~] 5.2 ~~Add ECR pull permissions to the Amplify template~~ (REMOVED — not needed for ECR Public)
    - ECR Public repositories are publicly accessible; Amplify's internal CodeBuild can pull without IAM permissions
    - Remove `AmplifyServiceRole` and `AmplifyEcrPolicy` resources if present
    - _Requirements: 4.2_

  - [~] 5.3 Write unit tests for updated Amplify template
    - Parse `deploy/frontend-deploy.yaml` and assert: `CustomBuildImageUri` parameter exists, `HasCustomImage` condition exists, `_CUSTOM_IMAGE` environment variable is set, no `AmplifyServiceRole` or `AmplifyEcrPolicy` resources exist
    - Test file: `_tests/unit/custom-build-image-amplify-template.test.js`
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Simplify amplify.yml
  - [x] 6.1 Remove RVM and NVM commands from `amplify.yml`
    - Remove `nvm install 22`, `rvm install 3.4.9`, `rvm use 3.4.9` from preBuild
    - Retain `npm ci`, `bundle install`, `npm run download-fonts`, `npm run copy-assets` in preBuild
    - Retain `bundle exec rake build:site` and `npm test` in build
    - Retain existing artifact and cache configuration
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 6.2 Write property test: No runtime version manager commands in build pipeline
    - **Property 1: No runtime version manager commands in build pipeline**
    - Generate random sets of shell commands including rvm/nvm-like strings using fast-check
    - Validate that a command validator correctly rejects commands containing `rvm` or `nvm`
    - Also assert the actual amplify.yml preBuild commands pass the validator
    - Test file: `_tests/property/amplify-no-version-managers.property.test.js`
    - **Validates: Requirements 5.1, 5.2, 4.3**

  - [x] 6.3 Write unit tests for simplified amplify.yml
    - Parse `amplify.yml` and assert: no rvm/nvm commands, npm ci present, bundle install present, download-fonts and copy-assets present, build commands present, artifacts and cache preserved
    - Test file: `_tests/unit/custom-build-image-amplify-yml.test.js`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 7. Checkpoint - Verify all templates and build config
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Create deployment documentation
  - [~] 8.1 Create `docs/custom-amplify-build-image/README.md`
    - Document prerequisites (AWS CLI, Docker, paddelbuch-dev profile)
    - Document CloudFormation stack deployment steps using AWS CLI with paddelbuch-dev profile in us-east-1 (ECR Public API region)
    - Document building and pushing the Docker image to ECR Public
    - Document updating the Amplify app stack with the custom image URI (public.ecr.aws format)
    - Document how to verify the Amplify app is using the custom image
    - Document how to update the image when dependencies change
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9. Version parity validation tests
  - [x] 9.1 Write unit tests for version parity
    - Assert Ruby version in Dockerfile matches `.ruby-version` file (3.4.9)
    - Assert Node.js major version in Dockerfile is 22
    - Assert Gemfile and Gemfile.lock are copied before `bundle install`
    - Assert package.json and package-lock.json are copied before `npm ci`
    - Test file: `_tests/unit/custom-build-image-version-parity.test.js`
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property test validates the universal correctness property from the design (no rvm/nvm in build pipeline)
- Unit tests validate structural correctness of configuration files by parsing them
- Byte-identical output parity (Requirement 7.1, 7.6, 7.7) is verified by manual integration testing and is not included as a coded task
- All AWS CLI commands use `paddelbuch-dev` profile; ECR Public commands target `us-east-1`, Amplify commands target `eu-central-1`
- ECR Public CloudFormation template is YAML format stored in `infrastructure/`; Amplify template in `deploy/`
- No IAM service role or ECR pull policy is needed for Amplify to access ECR Public images
