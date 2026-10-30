import * as fs from 'fs';
import { execSync } from 'child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as yaml from 'yaml';
import { compareOpenApiSpecs, OpenApiSpec } from './diff';
import { verifyActionLicense } from './license';

export interface ActionInputs {
  schemaPath: string;
  baseBranch: string;
  failOnBreaking: boolean;
  licenseKey?: string;
  isPrivateRepo: boolean;
}

export function parseSpecFile(content: string, filePath: string): OpenApiSpec {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as OpenApiSpec;
  }

  try {
    return yaml.parse(trimmed) as OpenApiSpec;
  } catch {
    return JSON.parse(trimmed) as OpenApiSpec;
  }
}

export async function runAction(
  inputs: ActionInputs,
  baseSpecContent: string,
  headSpecContent: string,
  setFailed: (msg: string) => void = console.error,
  setOutput: (name: string, value: any) => void = () => {}
): Promise<{ success: boolean; hasBreakingChanges: boolean; summary: string }> {
  // 1. Check license requirements
  const license = await verifyActionLicense(inputs.isPrivateRepo, inputs.licenseKey);
  console.log(`[License] ${license.message}`);

  if (!license.valid) {
    setFailed(license.message);
    return { success: false, hasBreakingChanges: false, summary: license.message };
  }

  // 2. Parse specifications
  let baseSpec: OpenApiSpec;
  let headSpec: OpenApiSpec;

  try {
    baseSpec = parseSpecFile(baseSpecContent, inputs.schemaPath);
    headSpec = parseSpecFile(headSpecContent, inputs.schemaPath);
  } catch (err: any) {
    const errMsg = `Failed to parse OpenAPI specification: ${err.message}`;
    setFailed(errMsg);
    return { success: false, hasBreakingChanges: false, summary: errMsg };
  }

  // 3. Compare specifications
  const diffResult = compareOpenApiSpecs(baseSpec, headSpec);

  setOutput('has-breaking-changes', diffResult.hasBreakingChanges.toString());
  setOutput('breaking-changes-count', diffResult.breakingChanges.length.toString());
  setOutput('diff-summary', diffResult.summaryMarkdown);

  console.log(diffResult.summaryMarkdown);

  // 4. Determine CI failure condition
  if (diffResult.hasBreakingChanges && inputs.failOnBreaking) {
    setFailed(
      `🚨 OpenAPI Schema Sentinel detected ${diffResult.breakingChanges.length} breaking API change(s)! Please review the summary report.`
    );
    return { success: false, hasBreakingChanges: true, summary: diffResult.summaryMarkdown };
  }

  return { success: true, hasBreakingChanges: diffResult.hasBreakingChanges, summary: diffResult.summaryMarkdown };
}

export async function run(): Promise<void> {
  try {
    const schemaPath = core.getInput('schema-path') || 'openapi.yaml';
    const baseBranch = core.getInput('base-branch') || 'main';
    const failOnBreakingStr = core.getInput('fail-on-breaking');
    const failOnBreaking = failOnBreakingStr !== 'false';
    const licenseKey = core.getInput('license-key') || '';
    const isPrivateRepo = github.context.payload.repository?.private ?? false;

    if (!fs.existsSync(schemaPath)) {
      core.setFailed(`OpenAPI specification file not found at path: ${schemaPath}`);
      return;
    }
    const headSpecContent = fs.readFileSync(schemaPath, 'utf8');

    let baseSpecContent = '';
    try {
      baseSpecContent = execSync(`git show origin/${baseBranch}:${schemaPath}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      try {
        baseSpecContent = execSync(`git show ${baseBranch}:${schemaPath}`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        try {
          execSync(`git fetch origin ${baseBranch} --depth=1`, { stdio: 'ignore' });
          baseSpecContent = execSync(`git show origin/${baseBranch}:${schemaPath}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        } catch (err: any) {
          core.warning(
            `Could not retrieve base specification from git branch '${baseBranch}': ${err.message}. Treating as initial specification release.`
          );
          baseSpecContent = headSpecContent;
        }
      }
    }

    const inputs: ActionInputs = {
      schemaPath,
      baseBranch,
      failOnBreaking,
      licenseKey,
      isPrivateRepo,
    };

    await runAction(
      inputs,
      baseSpecContent,
      headSpecContent,
      (msg) => core.setFailed(msg),
      (name, val) => core.setOutput(name, val)
    );
  } catch (error: any) {
    core.setFailed(error.message || 'An unexpected error occurred in OpenAPI Schema Sentinel.');
  }
}

if (!process.env.VITEST && (process.env.GITHUB_ACTIONS || (typeof require !== 'undefined' && require.main === module))) {
  run();
}
