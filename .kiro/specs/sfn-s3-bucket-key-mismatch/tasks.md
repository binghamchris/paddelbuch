# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - S3 Bucket Key Mismatch in Step Function States
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the four concrete affected states: CrawlGatsby, CrawlJekyll, MergeManifests, SummaryReport
  - Write a Python test that parses the CloudFormation template YAML, extracts the DefinitionString JSON from the PipelineStateMachine resource, and for each state in {CrawlGatsby, CrawlJekyll, MergeManifests, SummaryReport}:
    - Asserts the Parameters block contains `s3_bucket.$` (expected behavior)
    - Asserts the value of `s3_bucket.$` equals `$.artifact_bucket`
    - Asserts the Parameters block does NOT contain `artifact_bucket.$`
  - Test file: `paddelbuch-migrationuxtester/tests/test_sfn_s3_bucket_key.py`
  - Run test on UNFIXED code using `python3 -m pytest paddelbuch-migrationuxtester/tests/test_sfn_s3_bucket_key.py -v`
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because the four states still use `artifact_bucket.$` instead of `s3_bucket.$`)
  - Document counterexamples found: all four states have `artifact_bucket.$` in Parameters, confirming the mismatch with Lambda handlers expecting `s3_bucket`
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - All Other Template Content Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Write a Python test that captures a snapshot of the UNFIXED template and validates preservation properties:
    - Observe: Parse the full CloudFormation template and record all states in the DefinitionString
    - Observe: Record all parameters for each state, all Catch blocks, all resource definitions outside the state machine
    - Write property-based test: for all states NOT in {CrawlGatsby, CrawlJekyll, MergeManifests, SummaryReport}, their full definition is unchanged
    - Write property-based test: for the four affected states, all parameters OTHER than the bucket key (`artifact_bucket.$` / `s3_bucket.$`) are unchanged
    - Write property-based test: the JSONPath value `$.artifact_bucket` is preserved for the bucket parameter in all four states
    - Write property-based test: all non-DefinitionString resources (Lambdas, IAM roles, S3 bucket, Outputs) are unchanged
  - Test file: `paddelbuch-migrationuxtester/tests/test_sfn_preservation.py`
  - Run tests on UNFIXED code using `python3 -m pytest paddelbuch-migrationuxtester/tests/test_sfn_preservation.py -v`
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix S3 bucket key mismatch in Step Function DefinitionString

  - [x] 3.1 Implement the fix
    - In `paddelbuch-migrationuxtester/infrastructure/template.yaml`, rename the left-hand parameter key in the PipelineStateMachine DefinitionString for four states:
    - CrawlGatsby Parameters: change `"artifact_bucket.$"` to `"s3_bucket.$"` (keep value `"$.artifact_bucket"`)
    - CrawlJekyll Parameters: change `"artifact_bucket.$"` to `"s3_bucket.$"` (keep value `"$.artifact_bucket"`)
    - MergeManifests Parameters: change `"artifact_bucket.$"` to `"s3_bucket.$"` (keep value `"$.artifact_bucket"`)
    - SummaryReport Parameters: change `"artifact_bucket.$"` to `"s3_bucket.$"` (keep value `"$.artifact_bucket"`)
    - _Bug_Condition: isBugCondition(state) where state.name IN {CrawlGatsby, CrawlJekyll, MergeManifests, SummaryReport} AND state.Parameters contains key `artifact_bucket.$` AND NOT `s3_bucket.$`_
    - _Expected_Behavior: All four states use `s3_bucket.$` as the parameter key with JSONPath value `$.artifact_bucket`, so Lambda handlers receive `event["s3_bucket"]`_
    - _Preservation: All other template content (other parameters, JSONPath references, error handling, Lambda definitions, IAM roles, S3 bucket config) remains unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - S3 Bucket Key Correctly Named
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (asserts `s3_bucket.$` is present)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run: `python3 -m pytest paddelbuch-migrationuxtester/tests/test_sfn_s3_bucket_key.py -v`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - All Other Template Content Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run: `python3 -m pytest paddelbuch-migrationuxtester/tests/test_sfn_preservation.py -v`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `python3 -m pytest paddelbuch-migrationuxtester/tests/ -v`
  - Ensure all tests pass, ask the user if questions arise.
