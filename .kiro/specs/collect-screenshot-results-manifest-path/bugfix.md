# Bugfix Requirements Document

## Introduction

The `CollectScreenshotResults` Lambda fails with a `NoSuchKey` error when reading the DISTRIBUTED Map ResultWriter manifest from S3. The Lambda constructs the manifest key by appending `manifest.json` directly to the `screenshot_results_prefix`, but the Step Functions DISTRIBUTED Map ResultWriter inserts an execution-specific UUID subdirectory between the configured prefix and the output files. The Lambda never receives or discovers this UUID path segment, so it always looks for the manifest at the wrong key.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the `CollectScreenshotResults` Lambda constructs the manifest key using `{screenshot_results_prefix}manifest.json` THEN the system attempts to read from `{run_id}/distributed/screenshot_results/manifest.json`, which does not exist, and fails with a `NoSuchKey` error.

1.2 WHEN the Step Function invokes the `CollectScreenshotResults` Lambda THEN the system only passes `run_id`, `artifact_bucket`, `diff_threshold`, and a hardcoded `screenshot_results_prefix` — it does not pass the `screenshot_map_result` output that contains the actual ResultWriter path with the UUID subdirectory.

### Expected Behavior (Correct)

2.1 WHEN the `CollectScreenshotResults` Lambda constructs the manifest key THEN the system SHALL use the correct path that includes the UUID subdirectory, resolving to `{run_id}/distributed/screenshot_results/{uuid}/manifest.json`, and successfully read the manifest.

2.2 WHEN the Step Function invokes the `CollectScreenshotResults` Lambda THEN the system SHALL pass the `screenshot_map_result` (the DISTRIBUTED Map's ResultWriter output) to the Lambda so it can derive the correct manifest path including the UUID subdirectory.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the manifest is successfully read THEN the system SHALL CONTINUE TO extract individual ScreenshotResult items from the succeeded result files referenced in the manifest.

3.2 WHEN successful screenshot results are extracted THEN the system SHALL CONTINUE TO enrich each result with `run_id` and `diff_threshold` and write the comparison tasks JSON to S3 at `{run_id}/distributed/comparison_tasks.json`.

3.3 WHEN screenshot results are collected THEN the system SHALL CONTINUE TO write the consolidated screenshot results JSON to S3 at `{run_id}/distributed/screenshot_results.json`.

3.4 WHEN the Lambda completes THEN the system SHALL CONTINUE TO return `comparison_tasks_key`, `comparison_tasks_count`, and `screenshot_results_key` in the response.
