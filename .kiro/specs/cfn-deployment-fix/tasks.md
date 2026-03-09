# Tasks

## 1. Create Prerequisites Stack
- [x] 1.1 Create `infrastructure/prerequisites.yaml` with AWSTemplateFormatVersion, Description, and Parameters section
- [x] 1.2 Add the three ECR repository resources (CrawlerEcrRepository, ScreenshotCapturerEcrRepository, StructuralAnalyzerEcrRepository) with identical properties to the original template
- [x] 1.3 Add the S3 code bucket resource with name `migration-ux-tester-code-${AWS::AccountId}`, AES256 encryption, versioning enabled, and public access blocked
- [x] 1.4 Add Outputs section exporting ECR repository URIs (CrawlerEcrRepositoryUri, ScreenshotCapturerEcrRepositoryUri, StructuralAnalyzerEcrRepositoryUri) and code bucket name (CodeBucketName)

## 2. Modify Main Application Stack
- [x] 2.1 Remove the three ECR repository resources (CrawlerEcrRepository, ScreenshotCapturerEcrRepository, StructuralAnalyzerEcrRepository) from `infrastructure/template.yaml`
- [x] 2.2 Add new Parameters: CrawlerEcrRepoUri, ScreenshotCapturerEcrRepoUri, StructuralAnalyzerEcrRepoUri (type String) and CodeBucketName (type String)
- [x] 2.3 Update container-based Lambda ImageUri references to use the new ECR URI parameters (e.g., `!Sub '${CrawlerEcrRepoUri}:latest'`)
- [x] 2.4 Update zip-based Lambda S3Bucket references to use `!Ref CodeBucketName` instead of the hardcoded `!Sub 'migration-ux-tester-code-${AWS::AccountId}'`
- [x] 2.5 Remove the ECR repository URI outputs (CrawlerEcrRepositoryUri, ScreenshotCapturerEcrRepositoryUri, StructuralAnalyzerEcrRepositoryUri) from the Outputs section

## 3. Update README Deployment Instructions
- [x] 3.1 Rewrite the Deployment section with corrected step order: Step 1 = Deploy Prerequisites Stack, Step 2 = Build/Push Images and Upload Zips, Step 3 = Deploy Main Application Stack
- [x] 3.2 Add the `aws cloudformation deploy` command for the prerequisites stack (`migration-ux-tester-prereqs`)
- [x] 3.3 Update the main stack deploy command to include `--parameter-overrides` for CrawlerEcrRepoUri, ScreenshotCapturerEcrRepoUri, StructuralAnalyzerEcrRepoUri, and CodeBucketName
- [x] 3.4 Update the zip upload instructions to reference the code bucket from the prerequisites stack output instead of a hardcoded bucket name
