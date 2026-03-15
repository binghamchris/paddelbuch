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

describe('ECR CloudFormation template', () => {
  // Requirement 1.1: Template defines an ECR repository resource
  test('contains an AWS::ECR::Repository resource', () => {
    const ecrResources = Object.values(template.Resources).filter(
      (r) => r.Type === 'AWS::ECR::Repository'
    );
    expect(ecrResources.length).toBeGreaterThanOrEqual(1);
  });

  // Requirement 1.2: Image tag immutability disabled (MUTABLE)
  test('ECR repository has ImageTagMutability set to MUTABLE', () => {
    const ecrResource = Object.values(template.Resources).find(
      (r) => r.Type === 'AWS::ECR::Repository'
    );
    expect(ecrResource.Properties.ImageTagMutability).toBe('MUTABLE');
  });

  // Requirement 1.3: Lifecycle policy retains max 5 untagged images
  test('lifecycle policy retains max 5 untagged images', () => {
    const ecrResource = Object.values(template.Resources).find(
      (r) => r.Type === 'AWS::ECR::Repository'
    );
    const policyText = ecrResource.Properties.LifecyclePolicy.LifecyclePolicyText;
    const policy = JSON.parse(policyText);

    const untaggedRule = policy.rules.find(
      (rule) => rule.selection.tagStatus === 'untagged'
    );
    expect(untaggedRule).toBeDefined();
    expect(untaggedRule.selection.countType).toBe('imageCountMoreThan');
    expect(untaggedRule.selection.countNumber).toBe(5);
    expect(untaggedRule.action.type).toBe('expire');
  });

  // Requirement 1.4: Outputs include RepositoryUri and RepositoryArn
  test('outputs include RepositoryUri', () => {
    expect(template.Outputs).toHaveProperty('RepositoryUri');
  });

  test('outputs include RepositoryArn', () => {
    expect(template.Outputs).toHaveProperty('RepositoryArn');
  });
});
