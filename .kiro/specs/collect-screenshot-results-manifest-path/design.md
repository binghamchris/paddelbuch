# CollectScreenshotResults Manifest Path Bugfix Design

## Overview

The `CollectScreenshotResults` Lambda fails with `NoSuchKey` because it constructs the manifest S3 key by naively appending `manifest.json` to the `screenshot_results_prefix`. However, the Step Functions DISTRIBUTED Map `ResultWriter` inserts a UUID subdirectory between the configured prefix and the output files. The actual manifest lives at `{run_id}/distributed/screenshot_results/{uuid}/manifest.json`, not `{run_id}/distributed/screenshot_results/manifest.json`.

The fix requires two coordinated changes: (1) the Step Function must pass the `screenshot_map_result` (which contains the ResultWriter output with the UUID path) to the Lambda, and (2) the Lambda must extract the manifest key from that ResultWriter output instead of constructing it from the prefix.

## Glossary

- **Bug_Condition (C)**: The Lambda receives an event without `screenshot_map_result` and constructs the manifest key by appending `manifest.json` to `screenshot_results_prefix`, producing a path that does not include the UUID subdirectory inserted by the DISTRIBUTED Map ResultWriter.
- **Property (P)**: The Lambda uses the manifest key derived from the ResultWriter output (which includes the UUID subdirectory) and successfully reads the manifest from S3.
- **Preservation**: Downstream behavior after the manifest is read — extracting screenshot results, enriching comparison tasks, writing `comparison_tasks.json` and `screenshot_results.json` to S3, and returning the expected response keys — must remain unchanged.
- **`lambda_handler`**: The function in `src/collect_screenshot_results/handler.py` that reads the DISTRIBUTED Map manifest, extracts screenshot results, builds comparison tasks, and writes output to S3.
- **`screenshot_map_result`**: The ResultWriter output object stored at `$.screenshot_map_result` in the Step Function state, containing `ResultWriterDetails` with the manifest key including the UUID subdirectory.
- **ResultWriter**: The Step Functions DISTRIBUTED Map feature that writes execution results to S3, inserting a UUID subdirectory under the configured prefix.

## Bug Details

### Fault Condition

The bug manifests when the `CollectScreenshotResults` Lambda is invoked after a DISTRIBUTED Map execution. The Step Function does not pass `screenshot_map_result` to the Lambda. The Lambda constructs the manifest key as `{screenshot_results_prefix}manifest.json`, but the actual manifest is at `{screenshot_results_prefix}{uuid}/manifest.json` because the ResultWriter inserts a UUID subdirectory.

**Formal Specification:**
```
FUNCTION isBugCondition(event)
  INPUT: event of type LambdaEvent
  OUTPUT: boolean

  manifest_key_used := event.screenshot_results_prefix + "manifest.json"
  actual_manifest_key := event.screenshot_results_prefix + uuid + "/manifest.json"

  RETURN "screenshot_map_result" NOT IN event
         AND manifest_key_used != actual_manifest_key
END FUNCTION
```

### Examples

- **Example 1**: `run_id = "2025-02-22T10-00-00"`, ResultWriter UUID = `a1b2c3d4`. Lambda constructs key `2025-02-22T10-00-00/distributed/screenshot_results/manifest.json`. Actual key is `2025-02-22T10-00-00/distributed/screenshot_results/a1b2c3d4/manifest.json`. Result: `NoSuchKey` error.
- **Example 2**: `run_id = "2025-06-01T14-30-00"`, ResultWriter UUID = `deadbeef01234567`. Lambda constructs key `2025-06-01T14-30-00/distributed/screenshot_results/manifest.json`. Actual key is `2025-06-01T14-30-00/distributed/screenshot_results/deadbeef01234567/manifest.json`. Result: `NoSuchKey` error.
- **Example 3**: Any `run_id` with any UUID — the bug is deterministic. Every DISTRIBUTED Map execution inserts a UUID, so the Lambda always fails.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- After the manifest is successfully read, the Lambda must continue to extract individual `ScreenshotResult` items from the succeeded result files referenced in the manifest (Requirement 3.1).
- Successful screenshot results must continue to be enriched with `run_id` and `diff_threshold` and written to S3 at `{run_id}/distributed/comparison_tasks.json` (Requirement 3.2).
- Consolidated screenshot results must continue to be written to S3 at `{run_id}/distributed/screenshot_results.json` (Requirement 3.3).
- The Lambda must continue to return `comparison_tasks_key`, `comparison_tasks_count`, and `screenshot_results_key` in the response (Requirement 3.4).

**Scope:**
All behavior after the manifest key is resolved is completely unaffected by this fix. The fix only changes how the manifest key is determined — everything downstream of `_read_manifest()` remains identical. This includes:
- Parsing the manifest JSON structure
- Reading individual result files from S3
- Building enriched comparison tasks
- Writing output files to S3
- Constructing the return value

## Hypothesized Root Cause

Based on the bug description, the root cause is a two-part coordination failure between the Step Function definition and the Lambda handler:

1. **Step Function does not pass ResultWriter output**: The `CollectScreenshotResults` state in `template.yaml` constructs its `Parameters` block with only `run_id`, `artifact_bucket`, `diff_threshold`, and a hardcoded `screenshot_results_prefix`. It does not include `screenshot_map_result.$: "$.screenshot_map_result"`, so the Lambda never receives the ResultWriter output that contains the actual manifest path with the UUID subdirectory.

2. **Lambda constructs manifest key without UUID**: In `handler.py`, line `manifest_key = f"{screenshot_results_prefix}manifest.json"` assumes the manifest is directly under the prefix. This was likely written before understanding that the DISTRIBUTED Map ResultWriter always inserts a UUID subdirectory. The ResultWriter output (available in `$.screenshot_map_result.ResultWriterDetails.Key`) contains the correct manifest key including the UUID.

3. **No fallback or discovery mechanism**: The Lambda has no S3 `list_objects` fallback to discover the UUID subdirectory. It relies entirely on the constructed key, which is always wrong.

## Correctness Properties

Property 1: Fault Condition - Manifest Key Includes UUID Subdirectory

_For any_ Lambda invocation where the Step Function passes `screenshot_map_result` containing the ResultWriter output, the fixed `lambda_handler` SHALL extract the manifest key from the ResultWriter output (which includes the UUID subdirectory) and successfully read the manifest from S3, rather than constructing a key that omits the UUID.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Downstream Processing Unchanged

_For any_ Lambda invocation where the manifest is successfully read (regardless of how the key was determined), the fixed `lambda_handler` SHALL produce the same comparison tasks, the same consolidated screenshot results, and the same return value as the original function — preserving all downstream behavior including S3 writes and response structure.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `paddelbuch-migrationuxtester/infrastructure/template.yaml`

**State**: `CollectScreenshotResults` (within the Step Function `DefinitionString`)

**Specific Changes**:
1. **Pass `screenshot_map_result` to Lambda**: Add `"screenshot_map_result.$": "$.screenshot_map_result"` to the `Parameters` block of the `CollectScreenshotResults` state. This forwards the DISTRIBUTED Map's ResultWriter output (which contains the UUID path) to the Lambda.

**File**: `paddelbuch-migrationuxtester/src/collect_screenshot_results/handler.py`

**Function**: `lambda_handler`

**Specific Changes**:
2. **Extract manifest key from ResultWriter output**: Instead of constructing `manifest_key = f"{screenshot_results_prefix}manifest.json"`, extract the manifest key from `event["screenshot_map_result"]["ResultWriterDetails"]["Key"]`. The ResultWriter output has the structure `{"ResultWriterDetails": {"Bucket": "...", "Key": "{run_id}/distributed/screenshot_results/{uuid}/manifest.json"}}`.
3. **Remove or deprecate `screenshot_results_prefix`**: The `screenshot_results_prefix` parameter is no longer needed for manifest key construction. It can be removed from the event extraction or kept as a fallback, but the primary path should use the ResultWriter output.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that inspect the Step Function definition in `template.yaml` and the Lambda handler logic to verify the bug condition exists. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **Step Function Missing Parameter Test**: Parse the CloudFormation template and assert that the `CollectScreenshotResults` state's `Parameters` block includes `screenshot_map_result.$` — this will fail on unfixed code, confirming the Step Function doesn't pass the ResultWriter output.
2. **Lambda Manifest Key Construction Test**: Invoke `lambda_handler` with a mock event containing `screenshot_map_result` and verify it uses the ResultWriter key — this will fail on unfixed code because the handler ignores `screenshot_map_result`.
3. **UUID Path Mismatch Test**: Construct a manifest key using the Lambda's current logic and compare it to a key with a UUID subdirectory — this will demonstrate the mismatch.

**Expected Counterexamples**:
- The `CollectScreenshotResults` state parameters do not include `screenshot_map_result.$`
- The Lambda constructs `{prefix}manifest.json` instead of extracting the key from ResultWriter output
- Possible causes: missing parameter forwarding in Step Function, hardcoded manifest key construction in Lambda

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL event WHERE isBugCondition(event) DO
  result := lambda_handler_fixed(event)
  ASSERT result.manifest_key CONTAINS uuid_subdirectory
  ASSERT result.comparison_tasks_key IS valid
  ASSERT result.screenshot_results_key IS valid
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (i.e., the manifest is successfully read), the fixed function produces the same downstream results as the original function.

**Pseudocode:**
```
FOR ALL (manifest, run_id, diff_threshold) WHERE manifest IS valid DO
  original_output := process_manifest_original(manifest, run_id, diff_threshold)
  fixed_output := process_manifest_fixed(manifest, run_id, diff_threshold)
  ASSERT original_output.comparison_tasks == fixed_output.comparison_tasks
  ASSERT original_output.screenshot_results == fixed_output.screenshot_results
  ASSERT original_output.return_value == fixed_output.return_value
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many manifest structures with varying numbers of succeeded/failed files
- It catches edge cases like empty manifests, single-file manifests, and large result sets
- It provides strong guarantees that downstream processing is unchanged regardless of manifest content

**Test Plan**: Observe behavior on UNFIXED code for the downstream processing functions (`_read_result_files`, `_build_comparison_tasks`), then write property-based tests capturing that behavior to ensure the fix doesn't alter it.

**Test Cases**:
1. **Comparison Task Building Preservation**: Verify `_build_comparison_tasks` produces identical output for any set of screenshot results with varying `run_id` and `diff_threshold` values.
2. **Result File Extraction Preservation**: Verify `_read_result_files` produces identical output for any manifest structure.
3. **Response Structure Preservation**: Verify the Lambda return value always contains `comparison_tasks_key`, `comparison_tasks_count`, and `screenshot_results_key` with correct values.
4. **S3 Write Preservation**: Verify the Lambda writes to the same S3 keys (`{run_id}/distributed/comparison_tasks.json` and `{run_id}/distributed/screenshot_results.json`) regardless of how the manifest key was resolved.

### Unit Tests

- Test that `lambda_handler` extracts the manifest key from `screenshot_map_result.ResultWriterDetails.Key`
- Test that `lambda_handler` handles the case where `screenshot_map_result` is present with a valid ResultWriter structure
- Test edge case: `screenshot_map_result` with unexpected structure (graceful error handling)
- Test that the Step Function `CollectScreenshotResults` state passes `screenshot_map_result.$`

### Property-Based Tests

- Generate random `run_id` and UUID values, verify the Lambda uses the correct manifest key from ResultWriter output
- Generate random screenshot result sets, verify `_build_comparison_tasks` output is unchanged by the fix
- Generate random manifest structures, verify downstream processing produces consistent results

### Integration Tests

- Test full flow: DISTRIBUTED Map produces ResultWriter output → Step Function passes it to Lambda → Lambda reads correct manifest
- Test that comparison tasks written to S3 are valid JSON and contain all required fields
- Test that consolidated screenshot results written to S3 match the extracted results
