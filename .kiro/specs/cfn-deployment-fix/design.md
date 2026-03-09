# CloudFormation Deployment Fix - Bugfix Design

## Overview

The `migration-ux-tester` CloudFormation stack cannot be deployed from scratch because it has a circular dependency: Lambda functions require ECR images and S3 zip packages to exist at creation time, but the ECR repositories and code bucket are either created in the same stack (ECR) or not created at all (S3 code bucket). The README compounds this by instructing users to deploy the stack first, then push code — an impossible sequence.

The fix splits the single template into a prerequisites stack (`infrastructure/prerequisites.yaml`) containing ECR repositories and the S3 code bucket, and a main application stack (`infrastructure/template.yaml`) that accepts the pre-existing resource references as parameters. The README is updated to reflect the correct deployment order.

## Glossary

- **Bug_Condition (C)**: First-time deployment of the CloudFormation stack, where container-based Lambdas reference empty ECR repos and zip-based Lambdas reference a non-existent S3 code bucket
- **Property (P)**: A successful first-time deployment where prerequisites (ECR repos, code bucket) exist before Lambda functions are created
- **Preservation**: All existing Lambda configurations, IAM roles, Step Functions orchestration, S3 artifact bucket, and CloudWatch log groups must remain functionally identical
- **prerequisites stack**: A new CloudFormation stack (`infrastructure/prerequisites.yaml`) that creates ECR repositories and the S3 code bucket, exporting their identifiers
- **main application stack**: The modified `infrastructure/template.yaml` that accepts ECR repo URIs and code bucket name as parameters instead of creating them internally
- **Code Bucket**: The S3 bucket `migration-ux-tester-code-${AccountId}` used to store zip packages for the four zip-based Lambda functions

## Bug Details

### Fault Condition

The bug manifests when a user attempts a first-time deployment of the `migration-ux-tester` stack. Container-based Lambda functions fail because their `ImageUri` references ECR repositories that exist but contain no images. Zip-based Lambda functions fail because their `S3Bucket` references a bucket (`migration-ux-tester-code-${AccountId}`) that is never created by the template. The README instructs deploying the full stack before pushing images/code, making the sequence impossible.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type CloudFormationDeployment
  OUTPUT: boolean

  hasEmptyEcrRepos := input.stackContainsEcrRepos
                      AND input.ecrReposHaveNoImages
  hasMissingCodeBucket := input.zipLambdasReferenceCodeBucket
                          AND NOT input.codeBucketExistsInTemplate
                          AND NOT input.codeBucketExistsExternally
  hasWrongDeployOrder := input.readmeInstructsStackFirstThenPushCode

  RETURN (hasEmptyEcrRepos OR hasMissingCodeBucket OR hasWrongDeployOrder)
         AND input.isFirstTimeDeployment
END FUNCTION
```

### Examples

- User runs `aws cloudformation deploy --template-file infrastructure/template.yaml ...` on a fresh account → `CrawlerFunction` creation fails with "Manifest for latest not found" because `migration-ux-tester/crawler:latest` image does not exist in ECR
- User runs the same deploy → `VisualComparatorFunction` creation fails with "The bucket named migration-ux-tester-code-123456789012 does not exist" because no resource in the template creates it
- User follows README Step 1 (deploy stack) → Step 2 (push images) is unreachable because Step 1 fails, creating a deadlock
- User manually creates the code bucket and pushes zips, then deploys → container Lambdas still fail because ECR repos are empty at Lambda creation time

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All seven Lambda functions must retain their exact configurations: function names, package types, runtimes, handlers, memory sizes, timeouts, architectures, and environment variables
- All IAM roles must retain their exact least-privilege policies (S3 paths, log group ARNs, SSM parameter ARN)
- The Step Functions state machine definition must remain identical (same pipeline orchestration, error handling, concurrency settings)
- The S3 artifact bucket must continue to be created in the main stack with encryption, versioning, and public access block
- All CloudWatch log groups must retain their names and 30-day retention
- Both `dry-run` and `full` execution modes must continue to work identically

**Scope:**
All resources not involved in the ECR/code-bucket chicken-and-egg problem should be completely unaffected by this fix. This includes:
- Step Functions state machine definition
- IAM role policies and trust relationships
- Lambda environment variables and runtime configurations
- S3 artifact bucket configuration
- CloudWatch log group settings

## Hypothesized Root Cause

Based on the bug analysis, the root causes are:

1. **Same-stack ECR + Lambda coupling**: The ECR repositories (`CrawlerEcrRepository`, `ScreenshotCapturerEcrRepository`, `StructuralAnalyzerEcrRepository`) and the container-based Lambda functions that reference them are in the same stack. CloudFormation creates the ECR repos, then immediately tries to create the Lambda functions with `ImageUri` pointing to `:latest` — but no image has been pushed yet. CloudFormation does not allow a container Lambda to be created without a valid image manifest.

2. **Missing S3 code bucket resource**: The four zip-based Lambda functions reference `S3Bucket: !Sub 'migration-ux-tester-code-${AWS::AccountId}'`, but this bucket is never created by the template. It is a hardcoded bucket name that the template assumes exists externally, yet no other stack or manual step creates it before deployment.

3. **Incorrect README deployment sequence**: The README instructs users to deploy the full stack first (Step 1), then push images (Step 2) and upload zips (Step 3). Since Step 1 fails due to the above issues, Steps 2 and 3 are unreachable. The correct order should be: create prerequisites → push code → deploy main stack.

## Correctness Properties

Property 1: Fault Condition - Prerequisites Stack Enables First-Time Deployment

_For any_ first-time deployment where the bug condition holds (no ECR images exist, no code bucket exists), deploying the prerequisites stack SHALL create the three ECR repositories and the S3 code bucket, enabling the user to push images and upload zips before deploying the main application stack, which SHALL then succeed.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Lambda and Pipeline Configuration Unchanged

_For any_ deployment where the prerequisites are already in place (ECR images pushed, zips uploaded), the main application stack SHALL produce Lambda functions, IAM roles, Step Functions state machine, S3 artifact bucket, and CloudWatch log groups with identical configurations to the original single-stack template, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `infrastructure/prerequisites.yaml` (NEW)

**Purpose**: New CloudFormation template for resources that must exist before Lambda functions are created.

**Specific Changes**:
1. **Create ECR repositories**: Move `CrawlerEcrRepository`, `ScreenshotCapturerEcrRepository`, and `StructuralAnalyzerEcrRepository` from `template.yaml` into this new template with identical properties
2. **Create S3 code bucket**: Add a new `CodeBucket` resource of type `AWS::S3::Bucket` with the naming convention `migration-ux-tester-code-${AWS::AccountId}`, encryption enabled, and public access blocked
3. **Export outputs**: Export ECR repository URIs and the code bucket name via CloudFormation Outputs so the main stack can reference them as parameters

---

**File**: `infrastructure/template.yaml` (MODIFIED)

**Function**: Main application stack

**Specific Changes**:
1. **Remove ECR repository resources**: Delete `CrawlerEcrRepository`, `ScreenshotCapturerEcrRepository`, and `StructuralAnalyzerEcrRepository` resource definitions
2. **Add parameters for ECR repo URIs**: Add `CrawlerEcrRepoUri`, `ScreenshotCapturerEcrRepoUri`, and `StructuralAnalyzerEcrRepoUri` parameters of type `String`
3. **Add parameter for code bucket name**: Add `CodeBucketName` parameter of type `String`
4. **Update container Lambda ImageUri references**: Change from `!Sub '${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/${CrawlerEcrRepository}:latest'` to `!Sub '${CrawlerEcrRepoUri}:latest'` (and similarly for the other two)
5. **Update zip Lambda S3Bucket references**: Change from `!Sub 'migration-ux-tester-code-${AWS::AccountId}'` to `!Ref CodeBucketName`
6. **Remove ECR outputs**: Delete the `CrawlerEcrRepositoryUri`, `ScreenshotCapturerEcrRepositoryUri`, and `StructuralAnalyzerEcrRepositoryUri` outputs (these now live in the prerequisites stack)

---

**File**: `README.md` (MODIFIED)

**Purpose**: Correct the deployment sequence

**Specific Changes**:
1. **Reorder deployment steps**: Step 1 becomes "Deploy Prerequisites Stack", Step 2 becomes "Build and Push Container Images / Upload Zip Packages", Step 3 becomes "Deploy Main Application Stack"
2. **Add prerequisites deploy command**: `aws cloudformation deploy --template-file infrastructure/prerequisites.yaml --stack-name migration-ux-tester-prereqs ...`
3. **Update main stack deploy command**: Add `--parameter-overrides` for the new ECR URI and code bucket parameters, referencing the prerequisites stack outputs
4. **Update the code bucket reference in zip upload instructions**: Reference the prerequisites stack output instead of a hardcoded bucket name

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior. Since this is an infrastructure-as-code bug, testing focuses on template validation, structural correctness, and deployment simulation.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Validate the current template structure to confirm the circular dependency. Check that ECR repos and Lambda functions coexist in the same template, that the code bucket is never defined, and that the README has the wrong step order.

**Test Cases**:
1. **ECR-Lambda Coupling Test**: Parse `template.yaml` and verify that ECR repository resources and container Lambda functions referencing them exist in the same template (will confirm bug on unfixed code)
2. **Missing Code Bucket Test**: Parse `template.yaml` and verify that no S3 bucket resource matches the `migration-ux-tester-code-*` naming pattern (will confirm bug on unfixed code)
3. **README Order Test**: Parse `README.md` and verify that "Deploy the CloudFormation Stack" appears before "Build and Push Container Images" (will confirm bug on unfixed code)
4. **Zip Lambda S3 Reference Test**: Parse `template.yaml` and verify that zip-based Lambdas reference a hardcoded bucket name not defined in the template (will confirm bug on unfixed code)

**Expected Counterexamples**:
- Template contains both ECR repos and Lambdas referencing them, confirming the chicken-and-egg problem
- No code bucket resource exists in the template, confirming zip Lambdas reference a phantom bucket
- README deployment steps are in an impossible order

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed templates produce a deployable architecture.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := deployPrerequisitesStack(input) THEN pushCodeArtifacts() THEN deployMainStack(input)
  ASSERT result.prerequisitesStackSucceeds
  ASSERT result.mainStackSucceeds
  ASSERT result.allLambdasCreated
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (i.e., the main stack is deployed with valid prerequisites), the fixed templates produce the same resources as the original template.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  originalResources := parseTemplate(original_template.yaml)
  fixedResources := parseTemplate(fixed_prerequisites.yaml) UNION parseTemplate(fixed_template.yaml)
  ASSERT originalResources.lambdaConfigs = fixedResources.lambdaConfigs
  ASSERT originalResources.iamRoles = fixedResources.iamRoles
  ASSERT originalResources.stepFunctions = fixedResources.stepFunctions
  ASSERT originalResources.s3Buckets SUBSET_OF fixedResources.s3Buckets
  ASSERT originalResources.logGroups = fixedResources.logGroups
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It can generate many template parameter combinations to verify resource configurations are unchanged
- It catches edge cases in parameter substitution that manual tests might miss
- It provides strong guarantees that the split did not alter any resource properties

**Test Plan**: Parse the original template to capture all resource configurations, then parse the fixed templates and verify structural equivalence.

**Test Cases**:
1. **Lambda Config Preservation**: Verify all seven Lambda functions retain identical FunctionName, PackageType, Runtime, Handler, MemorySize, Timeout, Architectures, and Environment across original and fixed templates
2. **IAM Role Preservation**: Verify all IAM roles retain identical policy documents and trust relationships
3. **Step Functions Preservation**: Verify the state machine definition is byte-identical between original and fixed templates
4. **Log Group Preservation**: Verify all CloudWatch log groups retain identical names and retention periods

### Unit Tests

- Validate `prerequisites.yaml` is valid CloudFormation (cfn-lint)
- Validate modified `template.yaml` is valid CloudFormation (cfn-lint)
- Verify `prerequisites.yaml` contains exactly 3 ECR repos and 1 S3 bucket
- Verify `template.yaml` no longer contains ECR repository resources
- Verify `template.yaml` has new parameters for ECR URIs and code bucket name
- Verify container Lambda `ImageUri` references use the new parameters
- Verify zip Lambda `S3Bucket` references use the new parameter

### Property-Based Tests

- Generate random AWS account IDs and verify `Sub` expressions resolve correctly in both templates
- Generate random parameter values for ECR URIs and code bucket name, verify Lambda resource properties are well-formed
- Verify that the union of resources across both templates covers all resources from the original template

### Integration Tests

- Deploy prerequisites stack to a test account and verify ECR repos and code bucket are created
- Push placeholder images and zips, then deploy main stack and verify all Lambdas are created successfully
- Execute the Step Functions pipeline in dry-run mode and verify end-to-end functionality
