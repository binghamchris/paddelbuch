const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '../..');
const TEMPLATE_PATH = path.join(ROOT, 'deploy/frontend-deploy.yaml');

// Define custom YAML types for CloudFormation intrinsic functions (js-yaml v3 API)
const CF_TAGS = [
  'Ref', 'Sub', 'GetAtt', 'If', 'Select', 'Split', 'Join',
  'FindInMap', 'GetAZs', 'Base64', 'Cidr', 'ImportValue',
  'Condition', 'Equals', 'And', 'Or', 'Not',
].flatMap((fn) => [
  new yaml.Type(`!${fn}`, { kind: 'scalar', construct: (data) => ({ [`Fn::${fn}`]: data }) }),
  new yaml.Type(`!${fn}`, { kind: 'sequence', construct: (data) => ({ [`Fn::${fn}`]: data }) }),
  new yaml.Type(`!${fn}`, { kind: 'mapping', construct: (data) => ({ [`Fn::${fn}`]: data }) }),
]);

const CF_SCHEMA = yaml.Schema.create(CF_TAGS);

let template;

beforeAll(() => {
  const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  template = yaml.load(raw, { schema: CF_SCHEMA });
});

describe('Amplify template - custom build image support', () => {
  // Requirement 4.1: CustomBuildImageUri parameter exists with default empty string
  test('CustomBuildImageUri parameter exists with default empty string', () => {
    expect(template.Parameters).toHaveProperty('CustomBuildImageUri');
    const param = template.Parameters.CustomBuildImageUri;
    expect(param.Type).toBe('String');
    expect(param.Default).toBe('');
  });

  // Requirement 4.2: No HasCustomImage condition (not needed for ECR Public)
  test('HasCustomImage condition does not exist (not needed for ECR Public)', () => {
    if (template.Conditions) {
      expect(template.Conditions).not.toHaveProperty('HasCustomImage');
    }
  });

  // Requirement 4.3: PaddelBuchApp has _CUSTOM_IMAGE environment variable referencing CustomBuildImageUri
  test('PaddelBuchApp resource has _CUSTOM_IMAGE environment variable', () => {
    const app = template.Resources.PaddelBuchApp;
    expect(app).toBeDefined();
    expect(app.Type).toBe('AWS::Amplify::App');
    const envVars = app.Properties.EnvironmentVariables;
    expect(envVars).toBeDefined();
    const customImageVar = envVars.find((v) => v.Name === '_CUSTOM_IMAGE');
    expect(customImageVar).toBeDefined();
    // The value should reference the CustomBuildImageUri parameter
    expect(customImageVar.Value).toHaveProperty('Ref');
    expect(customImageVar.Value['Ref']).toBe('CustomBuildImageUri');
  });

  // Requirement 4.2: No AmplifyServiceRole or AmplifyEcrPolicy (ECR Public is publicly accessible)
  test('AmplifyServiceRole resource does not exist (not needed for ECR Public)', () => {
    expect(template.Resources).not.toHaveProperty('AmplifyServiceRole');
  });

  test('AmplifyEcrPolicy resource does not exist (not needed for ECR Public)', () => {
    expect(template.Resources).not.toHaveProperty('AmplifyEcrPolicy');
  });

  // Requirement 4.2: PaddelBuchApp has no IAMServiceRole property
  test('PaddelBuchApp does not have IAMServiceRole property', () => {
    const app = template.Resources.PaddelBuchApp;
    expect(app.Properties).not.toHaveProperty('IAMServiceRole');
  });
});
