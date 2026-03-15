# Requirements Document

## Introduction

The paddelbuch project is a Jekyll-based Swiss paddle sports map site deployed on AWS Amplify in eu-central-1. Currently, every Amplify build installs Ruby 3.4.9 via RVM and Node.js 22 via NVM from scratch, along with all gem and npm dependencies. This adds significant time to each build.

This feature introduces a custom Docker build image hosted in Amazon ECR Public (public.ecr.aws) that pre-packages Ruby 3.4.9, Node.js 22, and all project dependencies (gems and npm packages). AWS Amplify will use this custom image instead of its default image, eliminating runtime installation of language runtimes and reducing build times. ECR Public is required because Amplify's CodeBuild runs in an AWS-managed account that cannot pull from private ECR repositories in the customer's account. All infrastructure is defined as CloudFormation YAML templates stored in the `infrastructure/` directory.

## Glossary

- **Build_Image**: A Docker container image containing pre-installed language runtimes and project dependencies, used by AWS Amplify as the build environment
- **ECR_Public_Repository**: An Amazon Elastic Container Registry Public repository (public.ecr.aws) that stores and serves the Build_Image; ECR Public API is only available in us-east-1
- **Amplify_App**: The AWS Amplify application that builds and deploys the paddelbuch site
- **Dockerfile**: The file that defines how the Build_Image is assembled, specifying the base image, runtime installations, and dependency pre-installation
- **CloudFormation_Template**: An AWS CloudFormation YAML template stored in `infrastructure/` that declaratively provisions AWS resources
- **Build_Pipeline**: The sequence of preBuild and build phases defined in amplify.yml that Amplify executes to produce the site artifacts

## Requirements

### Requirement 1: ECR Public Repository Provisioning

**User Story:** As a developer, I want an ECR Public repository provisioned via CloudFormation, so that I have a publicly accessible registry to store the custom build image that Amplify can pull without cross-account authentication.

#### Acceptance Criteria

1. THE CloudFormation_Template SHALL define an ECR Public repository resource deployed in us-east-1 (ECR Public API region)
2. THE CloudFormation_Template SHALL configure the ECR Public repository with a repository name that identifies the project
3. THE CloudFormation_Template SHALL output the ECR Public repository URI (public.ecr.aws format) for use by other resources and deployment scripts
4. THE CloudFormation_Template SHALL include a repository catalog data section with a brief description

### Requirement 2: Custom Build Image Definition

**User Story:** As a developer, I want a Dockerfile that pre-installs Ruby 3.4.9, Node.js 22, and all project dependencies, so that Amplify builds skip runtime installation of these components.

#### Acceptance Criteria

1. THE Dockerfile SHALL use an Amazon Linux 2023-based image as the base
2. THE Dockerfile SHALL install Ruby 3.4.9 compiled from source
3. THE Dockerfile SHALL install Node.js 22 from the official NodeSource distribution or binary archive
4. THE Dockerfile SHALL copy the project Gemfile and Gemfile.lock and run `bundle install` to pre-install all gem dependencies
5. THE Dockerfile SHALL copy the project package.json and package-lock.json and run `npm ci` to pre-install all npm dependencies
6. THE Dockerfile SHALL set environment variables so that Ruby 3.4.9 and Node.js 22 are available on the default PATH without additional activation steps
7. IF the Dockerfile build fails due to missing system-level libraries, THEN THE Dockerfile SHALL install the required system-level libraries before compiling Ruby or installing gems

### Requirement 3: Image Build and Push Automation

**User Story:** As a developer, I want a script that builds the Docker image and pushes it to ECR Public, so that I can update the build image with a single command.

#### Acceptance Criteria

1. THE build script SHALL authenticate with ECR Public in us-east-1 using `aws ecr-public get-login-password` and the paddelbuch-dev AWS profile
2. THE build script SHALL build the Docker image from the Dockerfile
3. THE build script SHALL tag the built image with both a timestamp-based tag and the `latest` tag
4. THE build script SHALL push both tags to the ECR Public repository (public.ecr.aws URI)
5. IF the ECR Public authentication fails, THEN THE build script SHALL exit with a non-zero status and print a descriptive error message
6. IF the Docker build fails, THEN THE build script SHALL exit with a non-zero status and print a descriptive error message

### Requirement 4: Amplify App Configuration for Custom Image

**User Story:** As a developer, I want the Amplify app configured to use the custom ECR Public image, so that builds run in the pre-provisioned environment without requiring cross-account IAM permissions.

#### Acceptance Criteria

1. THE CloudFormation_Template SHALL configure the Amplify_App to use the custom Build_Image from the ECR_Public_Repository as its build environment via the `_CUSTOM_IMAGE` environment variable pointing to the public.ecr.aws URI
2. THE CloudFormation_Template SHALL NOT require an IAM service role or ECR pull policy for the Amplify_App to access the Build_Image, because ECR Public repositories are publicly accessible
3. WHEN the custom Build_Image is configured, THE Amplify_App SHALL use Ruby 3.4.9 and Node.js 22 from the image PATH without RVM or NVM installation steps

### Requirement 5: Simplified Build Specification

**User Story:** As a developer, I want the amplify.yml simplified to remove RVM and NVM installation steps, so that builds rely on the pre-installed runtimes in the custom image.

#### Acceptance Criteria

1. THE Build_Pipeline SHALL NOT include RVM installation or Ruby version switching commands in the preBuild phase
2. THE Build_Pipeline SHALL NOT include NVM installation or Node.js version switching commands in the preBuild phase
3. THE Build_Pipeline SHALL retain the `npm ci` command in the preBuild phase to ensure node_modules match the lock file at build time
4. THE Build_Pipeline SHALL retain the `bundle install` command in the preBuild phase to ensure gems match the lock file at build time
5. THE Build_Pipeline SHALL retain the `npm run download-fonts` and `npm run copy-assets` commands in the preBuild phase
6. THE Build_Pipeline SHALL retain the existing build commands (`bundle exec rake build:site` and `npm test`)
7. THE Build_Pipeline SHALL retain the existing artifact and cache configuration

### Requirement 6: Infrastructure Deployment Documentation

**User Story:** As a developer, I want clear deployment instructions, so that I can provision the infrastructure and build the image for the first time and on subsequent updates.

#### Acceptance Criteria

1. THE documentation SHALL describe the steps to deploy the ECR Public CloudFormation stack using the AWS CLI with the paddelbuch-dev profile in us-east-1
2. THE documentation SHALL describe the steps to build and push the Docker image to ECR Public
3. THE documentation SHALL describe how to verify that the Amplify app is using the custom image
4. THE documentation SHALL describe how to update the image when project dependencies change

### Requirement 7: Build Output Parity

**User Story:** As a developer, I want the site built with the custom image to produce byte-identical output to the existing build with the default Amplify image, so that there is no change in the design, functionality, or content of the site.

#### Acceptance Criteria

1. WHEN the site is built using the custom Build_Image, THE Build_Pipeline SHALL produce a `_site` directory that is byte-identical to the `_site` directory produced by the default Amplify image
2. THE Build_Image SHALL install the same Ruby version (3.4.9) as specified in the project `.ruby-version` file
3. THE Build_Image SHALL install the same Node.js major version (22) as specified in the `amplify.yml` preBuild phase
4. THE Build_Image SHALL install gem versions that match the versions pinned in the project `Gemfile.lock`
5. THE Build_Image SHALL install npm package versions that match the versions pinned in the project `package-lock.json`
6. THE Build_Image SHALL NOT introduce additional tools, plugins, or environment differences that alter the Jekyll build output
7. IF the `_site` output produced by the custom Build_Image differs from the output produced by the default Amplify image, THEN THE developer SHALL treat the difference as a defect and resolve the cause before deploying the custom Build_Image
