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

describe('Amplify template – custom build image support', () => {
  // Requirement 4.1: CustomBuildImageUri parameter exists with default empty string
  test('CustomBuildImageUri parameter exists with default empty string', () => {
    expect(template.Parameters).toHaveProperty('CustomBuildImageUri');
    const param = template.Parameters.CustomBuildImageUri;
    expect(param.Type).toBe('String');
    expect(param.Default).toBe('');
  });

  // Requirement 4.1: HasCustomImage condition exists
  test('HasCustomImage condition exists', () => {
    expect(template.Conditions).toHaveProperty('HasCustomImage');
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

  // Requirement 4.2: AmplifyEcrPolicy resource exists with ECR pull actions
  test('AmplifyEcrPolicy resource exists with correct ECR actions', () => {
    const policy = template.Resources.AmplifyEcrPolicy;
    expect(policy).toBeDefined();
    expect(policy.Type).toBe('AWS::IAM::Policy');

    const statements = policy.Properties.PolicyDocument.Statement;
    const allActions = statements.flatMap((s) =>
      Array.isArray(s.Action) ? s.Action : [s.Action]
    );

    expect(allActions).toContain('ecr:GetDownloadUrlForLayer');
    expect(allActions).toContain('ecr:BatchGetImage');
    expect(allActions).toContain('ecr:GetAuthorizationToken');
  });

  // Requirement 4.2: AmplifyServiceRole resource exists for Amplify
  test('AmplifyServiceRole IAM role exists for amplify.amazonaws.com', () => {
    const role = template.Resources.AmplifyServiceRole;
    expect(role).toBeDefined();
    expect(role.Type).toBe('AWS::IAM::Role');

    const principals = role.Properties.AssumeRolePolicyDocument.Statement.map(
      (s) => s.Principal.Service
    );
    expect(principals).toContain('amplify.amazonaws.com');
  });
});
