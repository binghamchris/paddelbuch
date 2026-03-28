# Requirements Document

## Introduction

Semantic Search adds a natural-language search capability to the Paddel Buch site. Users type a query in German or English and receive a ranked list of matching spots, obstacles, and event notices based on meaning rather than exact string matching. The feature uses Amazon Bedrock Titan Embeddings V2 to generate vector embeddings at build time, stores them in S3, and serves queries through an API Gateway + Lambda function that performs brute-force cosine similarity in memory. The frontend is a vanilla JavaScript search UI that integrates with the existing map and detail pages.

## Glossary

- **Search_UI**: The frontend vanilla JavaScript module (IIFE pattern) that renders the search input, result list, and handles user interaction.
- **Search_API**: The API Gateway HTTP API endpoint that accepts search queries and returns ranked results.
- **Search_Lambda**: The AWS Lambda function (ARM/Graviton, eu-central-1) that receives a query from the Search_API, generates a query embedding via Bedrock, and performs cosine similarity against the Embeddings_Index.
- **Embeddings_Index**: A JSON file stored in S3 containing pre-computed vector embeddings and metadata for all searchable content items.
- **Embedding_Builder**: A build-time script that extracts text from content items, calls Bedrock Titan Embeddings V2 to generate vector embeddings, and uploads the Embeddings_Index to S3.
- **Bedrock_Client**: The Amazon Bedrock runtime client used to invoke the Titan Embeddings V2 model for generating vector embeddings.
- **Content_Item**: A spot, obstacle, or event notice stored in the site's YAML data files, each identified by a slug and locale.
- **Query_Embedding**: The vector representation of a user's search string, generated at query time by the Search_Lambda via Bedrock.
- **Cosine_Similarity**: A measure of similarity between two vectors, ranging from -1 to 1, where 1 indicates identical direction.
- **Result_Entry**: A single search result returned by the Search_API, containing the content type, slug, name, score, and location data.

## Requirements

### Requirement 1: Build-Time Embedding Generation

**User Story:** As a site maintainer, I want all searchable content to be embedded at build time, so that search queries can be answered without real-time content processing.

#### Acceptance Criteria

1. WHEN a site build is triggered, THE Embedding_Builder SHALL extract a text representation from each Content_Item by concatenating the item's name, type label, and waterway name (where available) into a single string.
2. WHEN the text representation for a Content_Item is extracted, THE Embedding_Builder SHALL include both the German and English locale variants as separate entries in the Embeddings_Index.
3. WHEN text representations are ready, THE Embedding_Builder SHALL call the Bedrock_Client with the Titan Embeddings V2 model to generate a vector embedding for each text representation.
4. WHEN all embeddings are generated, THE Embedding_Builder SHALL produce the Embeddings_Index as a JSON file containing, for each entry: the content type, slug, locale, display name, vector embedding, location coordinates (latitude and longitude, where available), and waterway slug (where available).
5. WHEN the Embeddings_Index JSON file is produced, THE Embedding_Builder SHALL upload the file to the designated S3 bucket.
6. IF the Bedrock_Client returns an error for a specific Content_Item, THEN THE Embedding_Builder SHALL log the error with the item's slug and locale, skip that item, and continue processing the remaining items.
7. IF the S3 upload fails, THEN THE Embedding_Builder SHALL exit with a non-zero status code and log the failure reason.

### Requirement 2: Search Query Processing

**User Story:** As a paddler, I want to search for spots, obstacles, and event notices using natural language, so that I can find relevant locations without knowing exact names.

#### Acceptance Criteria

1. WHEN the Search_Lambda receives a query string and locale via the Search_API, THE Search_Lambda SHALL generate a Query_Embedding using the Bedrock_Client with the Titan Embeddings V2 model.
2. WHEN the Query_Embedding is generated, THE Search_Lambda SHALL compute the Cosine_Similarity between the Query_Embedding and every entry in the Embeddings_Index that matches the requested locale.
3. WHEN similarity scores are computed, THE Search_Lambda SHALL return the top 20 results sorted by descending Cosine_Similarity score.
4. THE Search_Lambda SHALL load the Embeddings_Index from S3 into memory on cold start and reuse the cached index for subsequent invocations within the same execution context.
5. WHEN the Search_Lambda returns results, each Result_Entry SHALL contain: the content type (spot, obstacle, or notice), slug, display name, similarity score, and location coordinates (where available).
6. IF the query string is empty or contains only whitespace, THEN THE Search_Lambda SHALL return an empty result array with a 200 status code.
7. IF the Bedrock_Client fails to generate the Query_Embedding, THEN THE Search_Lambda SHALL return a 502 status code with an error message indicating the embedding service is unavailable.
8. IF the Embeddings_Index cannot be loaded from S3, THEN THE Search_Lambda SHALL return a 503 status code with an error message indicating the search index is unavailable.

### Requirement 3: Search API Endpoint

**User Story:** As a frontend developer, I want a stable HTTP API for search queries, so that the Search_UI can call it reliably.

#### Acceptance Criteria

1. THE Search_API SHALL expose an HTTP GET endpoint that accepts a query parameter `q` (the search string) and a query parameter `locale` (either `de` or `en`).
2. THE Search_API SHALL return responses with `Content-Type: application/json` and include an `Access-Control-Allow-Origin` header set to the site's origin (`https://www.paddelbuch.ch`).
3. WHEN the `locale` parameter is missing, THE Search_API SHALL default to `de`.
4. IF the `q` parameter is missing, THEN THE Search_API SHALL return a 400 status code with an error message.
5. IF the `locale` parameter contains a value other than `de` or `en`, THEN THE Search_API SHALL return a 400 status code with an error message.
6. THE Search_API SHALL enforce a rate limit to prevent abuse.

### Requirement 4: Frontend Search Interface

**User Story:** As a paddler, I want a search box on the map page where I can type a query and see matching results, so that I can quickly find places to paddle.

#### Acceptance Criteria

1. THE Search_UI SHALL render a text input field with a search icon and a placeholder text appropriate to the current locale (German: "Suche…", English: "Search…").
2. WHEN the user types at least 2 characters into the search input, THE Search_UI SHALL send a request to the Search_API after a 400ms debounce period.
3. WHEN the Search_API returns results, THE Search_UI SHALL display a dropdown list showing each Result_Entry's display name, content type icon, and waterway name (where available).
4. WHEN the user selects a result from the dropdown list, THE Search_UI SHALL navigate to the detail page for that Content_Item (using the existing URL patterns: `/einstiegsorte/{slug}/` for spots, `/hindernisse/{slug}/` for obstacles, `/gewaesserereignisse/{slug}/` for notices in German locale; `/en/` prefixed equivalents for English).
5. WHEN the user clears the search input, THE Search_UI SHALL hide the results dropdown.
6. THE Search_UI SHALL display a loading indicator while a search request is in flight.
7. IF the Search_API returns an error, THEN THE Search_UI SHALL display a localized error message in the dropdown area (German: "Suche momentan nicht verfügbar", English: "Search currently unavailable").
8. IF the Search_API returns zero results, THEN THE Search_UI SHALL display a localized "no results" message (German: "Keine Ergebnisse gefunden", English: "No results found").
9. THE Search_UI SHALL follow the IIFE-to-global module pattern, registering as `PaddelbuchSemanticSearch` on the window object.
10. THE Search_UI SHALL comply with the site's Content Security Policy (`script-src 'self'`, `style-src 'self'`) by using no inline scripts, no inline styles, and no `eval()`.

### Requirement 5: Map Integration

**User Story:** As a paddler, I want search results to show on the map, so that I can see where the matching spots and obstacles are located.

#### Acceptance Criteria

1. WHEN the Search_API returns results that include location coordinates, THE Search_UI SHALL place temporary markers on the Leaflet map for each result that has coordinates.
2. WHEN temporary search result markers are placed on the map, THE Search_UI SHALL fit the map bounds to show all result markers.
3. WHEN the user selects a specific result from the dropdown, THE Search_UI SHALL pan the map to that result's coordinates and open its popup (where the item has a marker in the existing marker registry).
4. WHEN the user clears the search input, THE Search_UI SHALL remove all temporary search result markers from the map.

### Requirement 6: Bilingual Support

**User Story:** As a paddler who speaks German or English, I want search to work in my language, so that I get results matching my locale.

#### Acceptance Criteria

1. THE Search_UI SHALL detect the current page locale from the site's language configuration and pass the locale to the Search_API with each request.
2. WHEN the Search_Lambda filters the Embeddings_Index by locale, THE Search_Lambda SHALL return only results matching the requested locale.
3. THE Embedding_Builder SHALL generate embeddings using the locale-specific name for each Content_Item (German name for `de` entries, English name for `en` entries).
4. WHEN a user searches in German, THE Search_Lambda SHALL handle German compound words (e.g., "Einstiegsort"), umlauts (ä, ö, ü), and inflected forms by relying on the semantic understanding of the Titan Embeddings V2 model.

### Requirement 7: Infrastructure Deployment

**User Story:** As a site maintainer, I want the search infrastructure to be defined as code, so that it can be deployed and updated reliably.

#### Acceptance Criteria

1. THE infrastructure SHALL be defined in a CloudFormation template that provisions the Search_Lambda (ARM/Graviton runtime), the API Gateway HTTP API, the S3 bucket for the Embeddings_Index, and the required IAM roles.
2. THE Search_Lambda SHALL be deployed in the eu-central-1 region with a memory allocation sufficient to hold the Embeddings_Index in memory (estimated 10–15 MB for 2,020 entries).
3. THE CloudFormation template SHALL configure the Search_Lambda with an IAM role granting read access to the Embeddings_Index S3 bucket and invoke access to the Bedrock Titan Embeddings V2 model.
4. THE CloudFormation template SHALL configure the API Gateway with CORS settings allowing requests from `https://www.paddelbuch.ch`.
5. THE Search_API endpoint URL SHALL be configurable via an environment variable or site configuration so the Search_UI can reference the correct endpoint per deployment stage.
6. THE CloudFormation template SHALL configure the API Gateway with throttling settings to enforce the rate limit defined in Requirement 3.

### Requirement 8: CSP and Connect-Src Configuration

**User Story:** As a site maintainer, I want the search API calls to be permitted by the Content Security Policy, so that the browser does not block search requests.

#### Acceptance Criteria

1. WHEN the Search_API is deployed, THE site's Content Security Policy `connect-src` directive SHALL include the Search_API's domain so the browser permits fetch requests from the Search_UI to the Search_API.
2. THE CSP update SHALL be applied in the Amplify custom headers configuration in the CloudFormation template.

### Requirement 9: Search Performance

**User Story:** As a paddler, I want search results to appear quickly, so that the search experience feels responsive.

#### Acceptance Criteria

1. WHEN the Search_Lambda is warm (Embeddings_Index already in memory), THE Search_Lambda SHALL return results within 1500ms of receiving the request (including Bedrock embedding generation and cosine similarity computation).
2. THE Embeddings_Index JSON file SHALL be structured to allow the Search_Lambda to parse and load the index into memory within 2 seconds on cold start.
3. THE Search_UI SHALL cancel any in-flight search request when the user modifies the query text before the previous request completes.
