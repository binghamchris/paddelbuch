/**
 * Unit Tests for CSP Configuration
 *
 * Parses the Content-Security-Policy header from deploy/frontend-deploy.yaml
 * and asserts that the required directives for OpenFreeMap vector tiles are present.
 *
 * Validates: Requirements 8.4
 *
 * @jest-environment node
 */

var fs = require('fs');
var path = require('path');

/**
 * Extract the CSP header value from the YAML file content.
 * The CSP value spans multiple lines using YAML block scalar (>-).
 */
function extractCspValue(yamlContent) {
  // Match the Content-Security-Policy key and capture everything until the next
  // header key (a line starting with spaces + "- key:") or end of headers block
  var cspMatch = yamlContent.match(
    /- key:\s*Content-Security-Policy\s*\n\s*value:\s*>-\s*\n([\s\S]*?)(?=\n\s*- key:|\n\s*#|\n\s*- pattern:)/
  );

  if (!cspMatch) {
    throw new Error('Could not find Content-Security-Policy header in YAML');
  }

  // The captured group contains indented continuation lines.
  // Join them into a single string (YAML >- folds newlines into spaces).
  return cspMatch[1]
    .split('\n')
    .map(function(line) { return line.trim(); })
    .filter(function(line) { return line.length > 0; })
    .join(' ');
}

/**
 * Parse a CSP string into a map of directive -> value string.
 */
function parseCspDirectives(cspString) {
  var directives = {};
  // Split on semicolons, then parse each directive
  cspString.split(';').forEach(function(part) {
    var trimmed = part.trim();
    if (!trimmed) return;
    var spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex === -1) {
      directives[trimmed] = '';
    } else {
      var name = trimmed.substring(0, spaceIndex);
      var value = trimmed.substring(spaceIndex + 1).trim();
      directives[name] = value;
    }
  });
  return directives;
}

describe('CSP Configuration in frontend-deploy.yaml', () => {
  var yamlContent;
  var cspValue;
  var directives;

  beforeAll(() => {
    var yamlPath = path.resolve(__dirname, '../../deploy/frontend-deploy.yaml');
    yamlContent = fs.readFileSync(yamlPath, 'utf8');
    cspValue = extractCspValue(yamlContent);
    directives = parseCspDirectives(cspValue);
  });

  test('CSP header is present in the YAML file', () => {
    expect(cspValue).toBeDefined();
    expect(cspValue.length).toBeGreaterThan(0);
  });

  test('connect-src directive includes tiles.openfreemap.org', () => {
    expect(directives['connect-src']).toBeDefined();
    expect(directives['connect-src']).toContain('tiles.openfreemap.org');
  });

  test('worker-src directive includes blob:', () => {
    expect(directives['worker-src']).toBeDefined();
    expect(directives['worker-src']).toContain('blob:');
  });

  test('connect-src directive includes self', () => {
    expect(directives['connect-src']).toContain("'self'");
  });

  test('worker-src directive includes self', () => {
    expect(directives['worker-src']).toContain("'self'");
  });

  // Semantic search issues a cross-origin fetch to API Gateway, which
  // connect-src must permit or the browser blocks every search request.
  test('connect-src directive includes the search API host placeholder', () => {
    expect(directives['connect-src']).toContain('${SearchApiCspHost}');
  });

  test('CustomHeaders is a Sub block so the search host can be interpolated', () => {
    expect(yamlContent).toMatch(/CustomHeaders: !Sub \|-/);
  });

  test('SearchApiCspHost is the only placeholder inside CustomHeaders', () => {
    // A stray ${...} in a !Sub block fails the stack with an unresolved-reference
    // error, so the placeholder set is pinned rather than merely spot-checked.
    var block = yamlContent.match(/CustomHeaders: !Sub \|-\n([\s\S]*?)(?=\n {6}[A-Za-z])/);
    expect(block).not.toBeNull();
    var placeholders = block[1].match(/\$\{[^}]*\}/g) || [];
    expect(placeholders).toEqual(['${SearchApiCspHost}']);
  });

  test('search API parameters are declared with safe empty defaults', () => {
    // Empty defaults keep existing deploys working: no search config means the
    // search UI is simply not rendered.
    ['EnvVarSearchApiEndpoint', 'EnvVarSearchApiKey', 'SearchApiCspHost'].forEach(function(param) {
      var declared = new RegExp('^  ' + param + ':', 'm');
      expect(yamlContent).toMatch(declared);
    });
  });
});
