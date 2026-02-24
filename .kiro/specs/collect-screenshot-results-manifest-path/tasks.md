# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Manifest Key Missing UUID Subdirectory
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists in both the Step Function definition and the Lambda handler
  - **Scoped PBT Approach**: The bug is deterministic - scope the property to concrete cases demonstrating both parts of the fault condition
  - **Test file**: `tests/property/test_collect_manifest_path_exploration.py`
  - **Part A - Step Function Parameter Test**: Parse `infrastructure/template.yaml`, locate the `CollectScreenshotResults` state in the Step Function definition, and assert that its `Parameters` block includes `"screenshot_map_result.$": "$.screenshot_map_result"`. On unfixed code this parameter is missing, so the test will FAIL.
  - **Part B - Lambda Manifest Key Extraction Test**: Using Hypothesis, generate random `run_id` values (e.g., `YYYY-MM-DDThh-mm-ss` format) and random UUID strings. Construct a mock event containing `screenshot_map_result.ResultWriterDetails.Key` set to `{run_id}/distributed/screenshot_results/{uuid}/manifest.json`. Mock S3 calls (using `unittest.mock` or `moto`). Invoke `lambda_handler` and assert the manifest key passed to `_read_manifest` includes the UUID subdirectory (i.e., matches `screenshot_map_result["ResultWriterDetails"]["Key"]`), NOT the naive `{prefix}manifest.json`. On unfixed code the handler ignores `screenshot_map_result` and constructs the wrong key, so the test will FAIL.
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: the Step Function `Parameters` block lacks `screenshot_map_result.$` and the Lambda constructs `{prefix}manifest.json` instead of extracting from ResultWriter output
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Downstream Processing Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Test file**: `tests/property/test_collect_manifest_path_preservation.py`
  - **Observe on UNFIXED code**: Call `_build_comparison_tasks` with sample screenshot results, `run_id`, and `diff_threshold` — record that it filters by `success=True`, enriches with `run_id`/`diff_threshold`, and returns the expected comparison task dicts. Call `_read_result_files` with a mock S3 client and sample manifest file entries — record that it reads each file, parses JSON arrays, and concatenates results.
  - **Property 2a - Comparison Task Building**: Using Hypothesis, generate random lists of screenshot result dicts (with varying `success` flags, `run_id` strings, `diff_threshold` floats). Assert that `_build_comparison_tasks` returns only results where `success=True`, each enriched with `run_id`, `diff_threshold`, and all required keys (`gatsby_screenshot_key`, `jekyll_screenshot_key`, `gatsby_html_key`, `jekyll_html_key`, `url_slug`, `viewport_name`, `browser_engine`).
  - **Property 2b - Result File Extraction**: Using Hypothesis, generate random manifest structures with varying numbers of succeeded file entries. Mock S3 to return JSON arrays for each file. Assert that `_read_result_files` returns the flat concatenation of all arrays.
  - **Property 2c - Response Structure**: Assert that `lambda_handler` always returns a dict with keys `comparison_tasks_key`, `comparison_tasks_count`, and `screenshot_results_key`, and that the S3 keys follow the pattern `{run_id}/distributed/comparison_tasks.json` and `{run_id}/distributed/screenshot_results.json`.
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for CollectScreenshotResults manifest path missing UUID subdirectory

  - [x] 3.1 Update Step Function definition to pass screenshot_map_result
    - In `infrastructure/template.yaml`, locate the `CollectScreenshotResults` state within the Step Function `DefinitionString`
    - Add `"screenshot_map_result.$": "$.screenshot_map_result"` to the `Parameters` block of the `CollectScreenshotResults` state
    - This forwards the DISTRIBUTED Map's ResultWriter output (containing the UUID path) to the Lambda
    - _Bug_Condition: isBugCondition(event) where "screenshot_map_result" NOT IN event_
    - _Expected_Behavior: Step Function passes screenshot_map_result to Lambda so it can derive the correct manifest path_
    - _Preservation: All other Step Function states and parameters remain unchanged_
    - _Requirements: 1.2, 2.2_

  - [x] 3.2 Update Lambda handler to extract manifest key from ResultWriter output
    - In `src/collect_screenshot_results/handler.py`, in `lambda_handler`, replace `manifest_key = f"{screenshot_results_prefix}manifest.json"` with extraction from `event["screenshot_map_result"]["ResultWriterDetails"]["Key"]`
    - The ResultWriter output structure is `{"ResultWriterDetails": {"Bucket": "...", "Key": "{run_id}/distributed/screenshot_results/{uuid}/manifest.json"}}`
    - Remove or deprecate the `screenshot_results_prefix` parameter since the manifest key is now derived from the ResultWriter output
    - _Bug_Condition: isBugCondition(event) where manifest_key_used != actual_manifest_key_
    - _Expected_Behavior: manifest_key = event["screenshot_map_result"]["ResultWriterDetails"]["Key"] which includes the UUID subdirectory_
    - _Preservation: All downstream processing after _read_manifest() remains identical — _read_result_files, _build_comparison_tasks, S3 writes, and return value are unchanged_
    - _Requirements: 1.1, 2.1_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Manifest Key Includes UUID Subdirectory
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: Step Function passes `screenshot_map_result` and Lambda extracts manifest key from ResultWriter output
    - Run: `python3 -m pytest tests/property/test_collect_manifest_path_exploration.py -v`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Downstream Processing Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run: `python3 -m pytest tests/property/test_collect_manifest_path_preservation.py -v`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all downstream behavior is unchanged: comparison task building, result file extraction, S3 writes, response structure
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `python3 -m pytest tests/ -v`
  - Ensure all tests pass, ask the user if questions arise.
