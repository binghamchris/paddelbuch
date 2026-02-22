# Bugfix Requirements Document

## Introduction

The Step Function pipeline fails during execution because the Step Function definition passes the S3 bucket name using the key `artifact_bucket`, while all Lambda handlers expect the key `s3_bucket`. This causes `KeyError: 's3_bucket'` in the crawler Lambdas, which cascades into downstream step failures (screenshots, comparisons, reports) since no crawl data is produced.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Step Function executes the CrawlGatsby task THEN the system passes the S3 bucket name under the key `artifact_bucket` in the Lambda event payload, causing the crawler Lambda to throw `KeyError: 's3_bucket'`

1.2 WHEN the Step Function executes the CrawlJekyll task THEN the system passes the S3 bucket name under the key `artifact_bucket` in the Lambda event payload, causing the crawler Lambda to throw `KeyError: 's3_bucket'`

1.3 WHEN the Step Function executes the MergeManifests pass state THEN the system propagates the S3 bucket name under the key `artifact_bucket` into downstream state data, causing all subsequent Map iteration Lambdas (screenshot_capturer, visual_comparator, structural_analyzer, report_generator, issue_creator) to receive the wrong key name

1.4 WHEN the Step Function executes the SummaryReport task THEN the system passes the S3 bucket name under the key `artifact_bucket` in the Lambda event payload, causing the summary_report Lambda to throw `KeyError: 's3_bucket'`

### Expected Behavior (Correct)

2.1 WHEN the Step Function executes the CrawlGatsby task THEN the system SHALL pass the S3 bucket name under the key `s3_bucket` in the Lambda event payload so the crawler Lambda can access it without error

2.2 WHEN the Step Function executes the CrawlJekyll task THEN the system SHALL pass the S3 bucket name under the key `s3_bucket` in the Lambda event payload so the crawler Lambda can access it without error

2.3 WHEN the Step Function executes the MergeManifests pass state THEN the system SHALL propagate the S3 bucket name under the key `s3_bucket` into downstream state data so all subsequent Map iteration Lambdas receive the correct key name

2.4 WHEN the Step Function executes the SummaryReport task THEN the system SHALL pass the S3 bucket name under the key `s3_bucket` in the Lambda event payload so the summary_report Lambda can access it without error

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the Step Function execution input contains `artifact_bucket` at the top level THEN the system SHALL CONTINUE TO source the bucket name from `$.artifact_bucket` in the state input (only the left-hand key name in the Parameters mapping changes, not the JSONPath reference)

3.2 WHEN the Step Function executes tasks other than CrawlGatsby, CrawlJekyll, MergeManifests, and SummaryReport THEN the system SHALL CONTINUE TO pass all other parameters unchanged

3.3 WHEN Lambda functions receive the event payload with `s3_bucket` THEN the system SHALL CONTINUE TO use the same S3 bucket resource (ArtifactBucket) for storing and retrieving pipeline artifacts

3.4 WHEN the Step Function catches errors in any task state THEN the system SHALL CONTINUE TO route to the existing failure-handling states (GatsbyCrawlFailed, JekyllCrawlFailed, ScreenshotFailed, SummaryFailed, etc.)
