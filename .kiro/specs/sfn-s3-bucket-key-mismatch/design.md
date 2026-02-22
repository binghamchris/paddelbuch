# S3 Bucket Key Mismatch Bugfix Design

## Overview

The Step Function pipeline fails because four states in the `DefinitionString` pass the S3 bucket name to Lambda functions using the parameter key `artifact_bucket`, while every Lambda handler reads `event["s3_bucket"]`. The fix renames the left-hand key in the `Parameters` block of CrawlGatsby, CrawlJekyll, MergeManifests, and SummaryReport from `artifact_bucket.$` to `s3_bucket.$`, keeping the JSONPath reference `$.artifact_bucket` unchanged. No Lambda code changes are required.

## Glossary

- **Bug_Condition (C)**: A Step Function state whose `Parameters` block maps the S3 bucket name under the key `artifact_bucket` instead of `s3_bucket`
- **Property (P)**: The Lambda event payload contains the bucket name under the key `s3_bucket`, matching what all handlers expect
- **Preservation**: All other parameters, JSONPath references, error handling, and state machine structure remain unchanged
- **DefinitionString**: The JSON-encoded Amazon States Language definition inside the CloudFormation `PipelineStateMachine` resource
- **artifact_bucket**: The field name in the Step Function execution input that holds the S3 bucket name (sourced via `$.artifact_bucket`)
- **s3_bucket**: The event key all Lambda handlers use to read the S3 bucket name

## Bug Details

### Fault Condition

The bug manifests when the Step Function executes any of the four affected states (CrawlGatsby, CrawlJekyll, MergeManifests, SummaryReport). Each state's `Parameters` block maps `"artifact_bucket.$": "$.artifact_bucket"`, which means the Lambda receives `event["artifact_bucket"]` instead of `event["s3_bucket"]`. The Lambda then raises `KeyError: 's3_bucket'`.

**Formal Specification:**
```
FUNCTION isBugCondition(state)
  INPUT: state of type StepFunctionTaskState
  OUTPUT: boolean

  RETURN state.name IN ['CrawlGatsby', 'CrawlJekyll', 'MergeManifests', 'SummaryReport']
         AND state.Parameters contains key 'artifact_bucket.$'
         AND state.Parameters does NOT contain key 's3_bucket.$'
         AND targetLambdaExpects(state, 's3_bucket')
END FUNCTION
```

### Examples

- CrawlGatsby passes `{"artifact_bucket": "my-bucket", ...}` → crawler Lambda does `event["s3_bucket"]` → `KeyError: 's3_bucket'`
- CrawlJekyll passes `{"artifact_bucket": "my-bucket", ...}` → crawler Lambda does `event["s3_bucket"]` → `KeyError: 's3_bucket'`
- MergeManifests propagates `artifact_bucket` into downstream state data → ScreenshotMap items lack `s3_bucket` → screenshot_capturer, visual_comparator, structural_analyzer, report_generator, issue_creator all fail
- SummaryReport passes `{"artifact_bucket": "my-bucket", ...}` → summary_report Lambda does `event["s3_bucket"]` → `KeyError: 's3_bucket'`

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The JSONPath reference `$.artifact_bucket` continues to source the bucket name from the execution input's `artifact_bucket` field
- All parameters other than the bucket key name in the four affected states remain identical
- Error handling (Catch blocks routing to GatsbyCrawlFailed, JekyllCrawlFailed, ScreenshotFailed, SummaryFailed, etc.) remains unchanged
- All Lambda function code, IAM roles, environment variables, and resource definitions remain unchanged
- States not listed in the bug condition (ScreenshotMap, CompareMap, ReportMap, IssueCreateMap, ModeCheck) remain unchanged

**Scope:**
All aspects of the CloudFormation template outside the four `Parameters` blocks are unaffected. Specifically:
- Lambda function definitions and their environment variables
- IAM roles and policies
- S3 bucket configuration
- Step Function role and state machine structure
- All other parameter mappings within the four affected states

## Hypothesized Root Cause

Based on the bug description, the root cause is straightforward:

1. **Copy-paste naming error**: The `Parameters` blocks were authored using the execution input field name (`artifact_bucket`) as the left-hand key, rather than the key name the Lambda handlers expect (`s3_bucket`). Step Functions `Parameters` left-hand keys become the keys in the Lambda event payload, so `"artifact_bucket.$"` produces `event["artifact_bucket"]` instead of `event["s3_bucket"]`.

2. **No contract validation**: There is no schema or contract check between the Step Function definition and the Lambda handler signatures, so the mismatch went undetected until runtime.

## Correctness Properties

Property 1: Fault Condition - S3 Bucket Key Correctly Named

_For any_ Step Function state in {CrawlGatsby, CrawlJekyll, MergeManifests, SummaryReport}, the fixed template SHALL use the parameter key `s3_bucket.$` (not `artifact_bucket.$`) so that the Lambda event payload contains the bucket name under the key `s3_bucket`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - All Other Template Content Unchanged

_For any_ content in the CloudFormation template outside the four renamed parameter keys, the fixed template SHALL be identical to the original template, preserving all JSONPath references, error handling, state structure, Lambda definitions, IAM roles, and other parameters.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `paddelbuch-migrationuxtester/infrastructure/template.yaml`

**Resource**: `PipelineStateMachine` → `DefinitionString`

**Specific Changes**:
1. **CrawlGatsby Parameters** (line ~561): Rename `"artifact_bucket.$": "$.artifact_bucket"` to `"s3_bucket.$": "$.artifact_bucket"`

2. **CrawlJekyll Parameters** (line ~596): Rename `"artifact_bucket.$": "$.artifact_bucket"` to `"s3_bucket.$": "$.artifact_bucket"`

3. **MergeManifests Parameters** (line ~628): Rename `"artifact_bucket.$": "$.artifact_bucket"` to `"s3_bucket.$": "$.artifact_bucket"`

4. **SummaryReport Parameters** (line ~863): Rename `"artifact_bucket.$": "$.artifact_bucket"` to `"s3_bucket.$": "$.artifact_bucket"`

In all four cases, only the left-hand key changes. The right-hand JSONPath value `"$.artifact_bucket"` stays the same because that references the execution input field.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the bug exists in the unfixed template by inspecting the parameter keys, then verify the fix renames exactly the right keys without altering anything else.

### Exploratory Fault Condition Checking

**Goal**: Confirm the four affected states use `artifact_bucket.$` as the parameter key BEFORE implementing the fix.

**Test Plan**: Parse the DefinitionString JSON from the CloudFormation template and assert that the four states contain `artifact_bucket.$` in their Parameters. This confirms the bug condition on unfixed code.

**Test Cases**:
1. **CrawlGatsby Key Check**: Verify CrawlGatsby Parameters contains `artifact_bucket.$` and not `s3_bucket.$` (will pass on unfixed code, confirming bug)
2. **CrawlJekyll Key Check**: Verify CrawlJekyll Parameters contains `artifact_bucket.$` and not `s3_bucket.$` (will pass on unfixed code, confirming bug)
3. **MergeManifests Key Check**: Verify MergeManifests Parameters contains `artifact_bucket.$` and not `s3_bucket.$` (will pass on unfixed code, confirming bug)
4. **SummaryReport Key Check**: Verify SummaryReport Parameters contains `artifact_bucket.$` and not `s3_bucket.$` (will pass on unfixed code, confirming bug)

**Expected Counterexamples**:
- All four states use `artifact_bucket.$` as the parameter key, confirming the mismatch with Lambda handlers that expect `s3_bucket`

### Fix Checking

**Goal**: Verify that for all four affected states, the fixed template uses `s3_bucket.$` as the parameter key while keeping the JSONPath reference `$.artifact_bucket`.

**Pseudocode:**
```
FOR ALL state IN ['CrawlGatsby', 'CrawlJekyll', 'MergeManifests', 'SummaryReport'] DO
  params := getStateParameters(fixedTemplate, state)
  ASSERT 's3_bucket.$' IN params
  ASSERT params['s3_bucket.$'] == '$.artifact_bucket'
  ASSERT 'artifact_bucket.$' NOT IN params
END FOR
```

### Preservation Checking

**Goal**: Verify that for all content outside the four renamed keys, the fixed template is identical to the original.

**Pseudocode:**
```
FOR ALL state NOT IN ['CrawlGatsby', 'CrawlJekyll', 'MergeManifests', 'SummaryReport'] DO
  ASSERT originalTemplate.state == fixedTemplate.state
END FOR

FOR ALL state IN ['CrawlGatsby', 'CrawlJekyll', 'MergeManifests', 'SummaryReport'] DO
  FOR ALL key IN state.Parameters WHERE key != 'artifact_bucket.$' AND key != 's3_bucket.$' DO
    ASSERT originalTemplate.state.Parameters[key] == fixedTemplate.state.Parameters[key]
  END FOR
END FOR
```

**Testing Approach**: Since this is a CloudFormation template change (not runtime code), property-based testing is less applicable. Instead, a diff-based comparison of the original and fixed templates is the most effective validation: the diff should show exactly four lines changed, each replacing `artifact_bucket.$` with `s3_bucket.$`.

**Test Cases**:
1. **Diff Line Count**: Verify the diff between original and fixed template contains exactly 4 changed lines
2. **Diff Content**: Verify each changed line only differs in `artifact_bucket.$` → `s3_bucket.$`
3. **Other States Unchanged**: Verify ScreenshotMap, CompareMap, ReportMap, IssueCreateMap, ModeCheck states are identical
4. **Non-StepFunction Resources Unchanged**: Verify Lambda definitions, IAM roles, S3 bucket, and Outputs are identical

### Unit Tests

- Parse the fixed template's DefinitionString and verify each of the four states has `s3_bucket.$` in Parameters
- Verify the JSONPath value remains `$.artifact_bucket` for all four states
- Verify no other parameter keys were modified in the four states

### Property-Based Tests

- Generate random state names from the definition and verify only the four target states were modified
- For each of the four fixed states, verify the only difference from the original is the key rename

### Integration Tests

- Deploy the fixed template to a test environment and execute the Step Function with a valid `artifact_bucket` input
- Verify CrawlGatsby and CrawlJekyll Lambdas receive `s3_bucket` in their event and execute without `KeyError`
- Verify the full pipeline completes through SummaryReport without S3 bucket key errors
