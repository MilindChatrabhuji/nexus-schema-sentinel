export interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info?: { title: string; version: string };
  paths: Record<string, Record<string, any>>;
  components?: { schemas?: Record<string, any> };
}

export interface BreakingChange {
  type: 'REMOVED_PATH' | 'REMOVED_METHOD' | 'NEW_REQUIRED_PARAM' | 'REMOVED_RESPONSE_STATUS';
  path: string;
  method?: string;
  description: string;
}

export interface NonBreakingChange {
  type: 'ADDED_PATH' | 'ADDED_METHOD' | 'ADDED_OPTIONAL_PARAM' | 'ADDED_RESPONSE_STATUS';
  path: string;
  method?: string;
  description: string;
}

export interface SchemaDiffResult {
  hasBreakingChanges: boolean;
  breakingChanges: BreakingChange[];
  nonBreakingChanges: NonBreakingChange[];
  summaryMarkdown: string;
}

export function compareOpenApiSpecs(baseSpec: OpenApiSpec, headSpec: OpenApiSpec): SchemaDiffResult {
  const breakingChanges: BreakingChange[] = [];
  const nonBreakingChanges: NonBreakingChange[] = [];

  const basePaths = baseSpec.paths || {};
  const headPaths = headSpec.paths || {};

  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

  // Check for removed paths or modified operations
  for (const path of Object.keys(basePaths)) {
    if (!headPaths[path]) {
      breakingChanges.push({
        type: 'REMOVED_PATH',
        path,
        description: `Endpoint \`${path}\` was completely deleted.`,
      });
      continue;
    }

    const baseOps = basePaths[path];
    const headOps = headPaths[path];

    for (const method of httpMethods) {
      if (baseOps[method] && !headOps[method]) {
        breakingChanges.push({
          type: 'REMOVED_METHOD',
          path,
          method: method.toUpperCase(),
          description: `HTTP method \`${method.toUpperCase()}\` was removed from \`${path}\`.`,
        });
      } else if (!baseOps[method] && headOps[method]) {
        nonBreakingChanges.push({
          type: 'ADDED_METHOD',
          path,
          method: method.toUpperCase(),
          description: `New HTTP method \`${method.toUpperCase()}\` added to \`${path}\`.`,
        });
      } else if (baseOps[method] && headOps[method]) {
        // Inspect parameters for new required parameters
        const baseParams = baseOps[method].parameters || [];
        const headParams = headOps[method].parameters || [];

        for (const hp of headParams) {
          if (hp.required) {
            const bp = baseParams.find((p: any) => p.name === hp.name && p.in === hp.in);
            if (!bp || !bp.required) {
              breakingChanges.push({
                type: 'NEW_REQUIRED_PARAM',
                path,
                method: method.toUpperCase(),
                description: `New required parameter \`${hp.name}\` (in \`${hp.in}\`) added to \`${method.toUpperCase()} ${path}\`.`,
              });
            }
          }
        }

        // Inspect response codes for removed status codes
        const baseResponses = Object.keys(baseOps[method].responses || {});
        const headResponses = Object.keys(headOps[method].responses || {});

        for (const code of baseResponses) {
          if (!headResponses.includes(code)) {
            breakingChanges.push({
              type: 'REMOVED_RESPONSE_STATUS',
              path,
              method: method.toUpperCase(),
              description: `Response status code \`${code}\` was removed from \`${method.toUpperCase()} ${path}\`.`,
            });
          }
        }
      }
    }
  }

  // Check for newly added paths
  for (const path of Object.keys(headPaths)) {
    if (!basePaths[path]) {
      nonBreakingChanges.push({
        type: 'ADDED_PATH',
        path,
        description: `New endpoint \`${path}\` introduced.`,
      });
    }
  }

  const hasBreakingChanges = breakingChanges.length > 0;
  const summaryMarkdown = formatDiffMarkdown(breakingChanges, nonBreakingChanges);

  return {
    hasBreakingChanges,
    breakingChanges,
    nonBreakingChanges,
    summaryMarkdown,
  };
}

function formatDiffMarkdown(breaking: BreakingChange[], nonBreaking: NonBreakingChange[]): string {
  const lines: string[] = ['### 🛡️ OpenAPI Schema Sentinel Report\n'];

  if (breaking.length === 0 && nonBreaking.length === 0) {
    lines.push('✅ **No API contract changes detected.** Schema is identical.');
    return lines.join('\n');
  }

  if (breaking.length > 0) {
    lines.push(`🚨 **${breaking.length} Breaking Change(s) Detected:**\n`);
    lines.push('| Severity | Path | Method | Description |');
    lines.push('| :---: | :--- | :---: | :--- |');
    for (const b of breaking) {
      lines.push(`| ❌ BREAKING | \`${b.path}\` | \`${b.method || 'ALL'}\` | ${b.description} |`);
    }
    lines.push('');
  } else {
    lines.push('✅ **No breaking changes detected.** Backward compatibility preserved.\n');
  }

  if (nonBreaking.length > 0) {
    lines.push(`ℹ️ **${nonBreaking.length} Non-Breaking Addition(s):**\n`);
    lines.push('| Type | Path | Method | Description |');
    lines.push('| :---: | :--- | :---: | :--- |');
    for (const nb of nonBreaking) {
      lines.push(`| ✨ NEW | \`${nb.path}\` | \`${nb.method || 'ALL'}\` | ${nb.description} |`);
    }
    lines.push('');
  }

  lines.push('> *Powered by [NexusPulse OpenAPI Schema Sentinel](https://github.com/MilindChatrabhuji/edgesaas-starter-kit)*');
  return lines.join('\n');
}
