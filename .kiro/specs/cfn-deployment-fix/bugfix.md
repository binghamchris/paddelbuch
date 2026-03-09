# Bugfix Requirements Document

## Introduction

The CloudFormation stack `migration-ux-tester` fails to deploy because it creates Lambda functions and their code dependencies (ECR repositories, S3 code bucket) in the same stack. Container-based Lambda functions require ECR images to exist at creation time, and zip-based Lambda functions reference an S3 code bucket (`migration-ux-tester-code-${AccountId}`) that is never created by the template. The README deployment steps instruct users to deploy the full stack first, then push images and upload zips, which is impossible because Lambda creation fails before the images/code exist.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the CloudFormation stack is deployed for the first time THEN the container-based Lambda functions (Crawler, ScreenshotCapturer, StructuralAnalyzer) fail to create because they reference ECR images that have not been pushed yet

1.2 WHEN the CloudFormation stack is deployed for the first time THEN the zip-based Lambda functions (VisualComparator, ReportGenerator, IssueCreator, SummaryReport) fail to create because they reference an S3 bucket (`migration-ux-tester-code-${AccountId}`) that does not exist in the template and has not been created

1.3 WHEN a user follows the README deployment steps in order (Step 1: deploy stack, Step 2: push images, Step 3: upload zips) THEN the deployment fails at Step 1, making Steps 2 and 3 unreachable

### Expected Behavior (Correct)

2.1 WHEN deploying for the first time THEN the system SHALL allow ECR repositories and the S3 code bucket to be created in a prerequisites stack before the main stack's Lambda functions are deployed, so that images and code can be pushed before Lambda creation

2.2 WHEN deploying for the first time THEN the zip-based Lambda functions SHALL reference an S3 code bucket that is explicitly created by the prerequisites stack rather than referencing a non-existent bucket

2.3 WHEN a user follows the README deployment steps in order THEN the system SHALL guide the user through a correct sequence: deploy prerequisites → push images and upload zips → deploy main application stack

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the main application stack is deployed with valid ECR images and zip packages already in place THEN the system SHALL CONTINUE TO create all seven Lambda functions with their correct configurations (memory, timeout, architecture, environment variables, IAM roles)

3.2 WHEN the main application stack is deployed THEN the system SHALL CONTINUE TO create the Step Functions state machine with the same pipeline orchestration logic (crawl → screenshot → compare → report → issue creation → summary)

3.3 WHEN the main application stack is deployed THEN the system SHALL CONTINUE TO create the S3 artifact bucket, CloudWatch log groups, and all IAM roles with least-privilege policies

3.4 WHEN the pipeline is executed after deployment THEN the system SHALL CONTINUE TO support both `dry-run` and `full` execution modes with the same behavior as before
