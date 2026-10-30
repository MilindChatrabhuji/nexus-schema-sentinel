import { describe, it, expect } from 'vitest';
import { compareOpenApiSpecs, OpenApiSpec } from '../src/diff';
import { verifyActionLicense } from '../src/license';
import { runAction, ActionInputs } from '../src/index';

describe('OpenAPI Schema Sentinel & GitHub Marketplace Action Engine', () => {
  const baseSpec: OpenApiSpec = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/v1/users': {
        get: {
          parameters: [{ name: 'limit', in: 'query', required: false }],
          responses: { '200': { description: 'OK' } },
        },
        post: {
          parameters: [{ name: 'email', in: 'query', required: true }],
          responses: { '201': { description: 'Created' }, '400': { description: 'Bad Request' } },
        },
      },
      '/v1/orders': {
        get: {
          responses: { '200': { description: 'OK' } },
        },
      },
    },
  };

  it('detects no breaking changes when schemas are identical', () => {
    const res = compareOpenApiSpecs(baseSpec, baseSpec);
    expect(res.hasBreakingChanges).toBe(false);
    expect(res.breakingChanges.length).toBe(0);
    expect(res.summaryMarkdown).toContain('No API contract changes detected');
  });

  it('detects a completely deleted endpoint as BREAKING', () => {
    const headSpec: OpenApiSpec = {
      ...baseSpec,
      paths: {
        '/v1/users': baseSpec.paths['/v1/users'], // /v1/orders removed!
      },
    };

    const res = compareOpenApiSpecs(baseSpec, headSpec);
    expect(res.hasBreakingChanges).toBe(true);
    expect(res.breakingChanges.length).toBe(1);
    expect(res.breakingChanges[0].type).toBe('REMOVED_PATH');
    expect(res.breakingChanges[0].path).toBe('/v1/orders');
    expect(res.summaryMarkdown).toContain('1 Breaking Change(s) Detected');
  });

  it('detects removed HTTP method as BREAKING', () => {
    const headSpec: OpenApiSpec = {
      ...baseSpec,
      paths: {
        ...baseSpec.paths,
        '/v1/users': {
          get: baseSpec.paths['/v1/users'].get, // POST removed!
        },
      },
    };

    const res = compareOpenApiSpecs(baseSpec, headSpec);
    expect(res.hasBreakingChanges).toBe(true);
    expect(res.breakingChanges.some((b) => b.type === 'REMOVED_METHOD')).toBe(true);
  });

  it('detects new required parameter as BREAKING', () => {
    const headSpec: OpenApiSpec = {
      ...baseSpec,
      paths: {
        ...baseSpec.paths,
        '/v1/users': {
          ...baseSpec.paths['/v1/users'],
          get: {
            parameters: [
              { name: 'limit', in: 'query', required: false },
              { name: 'organization_id', in: 'query', required: true }, // New required param!
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };

    const res = compareOpenApiSpecs(baseSpec, headSpec);
    expect(res.hasBreakingChanges).toBe(true);
    expect(res.breakingChanges.some((b) => b.type === 'NEW_REQUIRED_PARAM')).toBe(true);
  });

  it('detects removed response status code as BREAKING', () => {
    const headSpec: OpenApiSpec = {
      ...baseSpec,
      paths: {
        ...baseSpec.paths,
        '/v1/users': {
          ...baseSpec.paths['/v1/users'],
          post: {
            parameters: [{ name: 'email', in: 'query', required: true }],
            responses: { '201': { description: 'Created' } }, // 400 removed!
          },
        },
      },
    };

    const res = compareOpenApiSpecs(baseSpec, headSpec);
    expect(res.hasBreakingChanges).toBe(true);
    expect(res.breakingChanges.some((b) => b.type === 'REMOVED_RESPONSE_STATUS')).toBe(true);
  });

  it('recognizes new endpoints and optional methods as non-breaking', () => {
    const headSpec: OpenApiSpec = {
      ...baseSpec,
      paths: {
        ...baseSpec.paths,
        '/v1/reports': {
          get: { responses: { '200': { description: 'OK' } } },
        },
      },
    };

    const res = compareOpenApiSpecs(baseSpec, headSpec);
    expect(res.hasBreakingChanges).toBe(false);
    expect(res.nonBreakingChanges.length).toBe(1);
    expect(res.nonBreakingChanges[0].type).toBe('ADDED_PATH');
  });

  describe('Freemium License Verification', () => {
    it('grants free unlimited execution for open-source repositories', async () => {
      const res = await verifyActionLicense(false);
      expect(res.valid).toBe(true);
      expect(res.tier).toBe('open_source_free');
    });

    it('blocks unlicensed private repositories', async () => {
      const res = await verifyActionLicense(true, '');
      expect(res.valid).toBe(false);
      expect(res.tier).toBe('unlicensed_private');
    });

    it('authorizes commercial pro license keys for private repositories', async () => {
      const validKey = 'NEXUS-PRO-98472918471928471928';
      const res = await verifyActionLicense(true, validKey);
      expect(res.valid).toBe(true);
      expect(res.tier).toBe('commercial_pro');
    });
  });

  describe('End-to-End Action Runner', () => {
    it('fails CI job when breaking changes are detected on failOnBreaking=true', async () => {
      const inputs: ActionInputs = {
        schemaPath: 'openapi.json',
        baseBranch: 'main',
        failOnBreaking: true,
        isPrivateRepo: false,
      };

      let failedMessage = '';
      const outputs: Record<string, any> = {};

      const baseJson = JSON.stringify(baseSpec);
      const headJson = JSON.stringify({
        ...baseSpec,
        paths: { '/v1/users': baseSpec.paths['/v1/users'] }, // deleted /v1/orders
      });

      const res = await runAction(
        inputs,
        baseJson,
        headJson,
        (msg) => { failedMessage = msg; },
        (k, v) => { outputs[k] = v; }
      );

      expect(res.success).toBe(false);
      expect(res.hasBreakingChanges).toBe(true);
      expect(failedMessage).toContain('OpenAPI Schema Sentinel detected');
      expect(outputs['has-breaking-changes']).toBe('true');
    });
  });
});
