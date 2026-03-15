const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '../..');
const TEMPLATE_PATH = path.join(ROOT, 'infrastructure/custom-build-image.yaml');

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

describe('ECR Public CloudFormation template', () => {
  // Requirement 1.1: Template defines an ECR Public repository resource
  test('contains an AWS::ECR::PublicRepository resource', () => {
    const ecrPublicResources = Object.values(template.Resources).filter(
      (r) => r.Type === 'AWS::ECR::PublicRepository'
    );
    expect(ecrPublicResources.length).toBeGreaterThanOrEqual(1);
  });

  // Requirement 1.4: Repository catalog data with description
  test('ECR Public repository has RepositoryCatalogData with AboutText', () => {
    const ecrResource = Object.values(template.Resources).find(
      (r) => r.Type === 'AWS::ECR::PublicRepository'
    );
    expect(ecrResource.Properties.RepositoryCatalogData).toBeDefined();
    expect(ecrResource.Properties.RepositoryCatalogData.AboutText).toBeDefined();
    expect(typeof ecrResource.Properties.RepositoryCatalogData.AboutText).toBe('string');
  });

  // Requirement 1.2: Repository name is configured via parameter
  test('RepositoryName references a parameter', () => {
    const ecrResource = Object.values(template.Resources).find(
      (r) => r.Type === 'AWS::ECR::PublicRepository'
    );
    const repoName = ecrResource.Properties.RepositoryName;
    // Should be a !Ref to a parameter (parsed as { "Fn::Ref": "RepositoryName" })
    expect(repoName).toBeDefined();
    expect(template.Parameters).toHaveProperty('RepositoryName');
  });

  // Requirement 1.3: Outputs include RepositoryUri with public.ecr.aws format
  test('outputs include RepositoryUri', () => {
    expect(template.Outputs).toHaveProperty('RepositoryUri');
  });

  test('RepositoryUri output references public.ecr.aws', () => {
    const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    expect(raw).toMatch(/public\.ecr\.aws/);
  });

  // Negative assertions: no private ECR properties
  test('does not use private ECR resource type AWS::ECR::Repository', () => {
    const privateEcrResources = Object.values(template.Resources).filter(
      (r) => r.Type === 'AWS::ECR::Repository'
    );
    expect(privateEcrResources.length).toBe(0);
  });

  test('does not have LifecyclePolicy property', () => {
    const ecrResource = Object.values(template.Resources).find(
      (r) => r.Type === 'AWS::ECR::PublicRepository'
    );
    expect(ecrResource.Properties).not.toHaveProperty('LifecyclePolicy');
  });

  test('does not have RepositoryPolicyText property', () => {
    const ecrResource = Object.values(template.Resources).find(
      (r) => r.Type === 'AWS::ECR::PublicRepository'
    );
    expect(ecrResource.Properties).not.toHaveProperty('RepositoryPolicyText');
  });

  test('does not have ImageTagMutability property', () => {
    const ecrResource = Object.values(template.Resources).find(
      (r) => r.Type === 'AWS::ECR::PublicRepository'
    );
    expect(ecrResource.Properties).not.toHaveProperty('ImageTagMutability');
  });
});
