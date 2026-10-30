# OpenAPI Schema Sentinel (GitHub Action)

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-OpenAPI%20Sentinel-blue?logo=github)](https://github.com/marketplace/actions/openapi-schema-sentinel)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

A zero-dependency, automated GitHub Action that analyzes OpenAPI / Swagger specifications on every pull request, catches breaking API changes before they reach production, and posts actionable Markdown diff summaries directly on PRs.

![NexusPulse Banner](https://raw.githubusercontent.com/MilindChatrabhuji/edgesaas-starter-kit/main/assets/edgesaas-banner-hero.svg)

## Why Schema Sentinel?

Shipping an accidental breaking API change (deleting a query param, renaming an endpoint, or removing a response code) immediately breaks production mobile apps, frontend clients, and third-party webhooks.

Schema Sentinel automates backward compatibility testing directly in your CI pipeline.

### What It Catches

- ❌ **Deleted Endpoints**: Routes present on `main` that disappeared in the PR.
- ❌ **Removed HTTP Methods**: Operations removed from existing paths.
- ❌ **New Required Parameters**: Query, path, or header parameters that would break existing API clients.
- ❌ **Removed Response Codes**: E.g., removing `200` or `201` status responses.

---

## Quickstart

Add this step to your GitHub workflow (e.g. `.github/workflows/ci.yml`):

```yaml
name: API Governance
on: [pull_request]

jobs:
  schema-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Verify OpenAPI Contract Compatibility
        uses: MilindChatrabhuji/nexus-schema-sentinel@v1
        with:
          schema-path: 'docs/openapi.yaml'
          fail-on-breaking: 'true'
```

### Action Configuration

| Input | Description | Default |
| :--- | :--- | :--- |
| `schema-path` | Path to your OpenAPI 3.x file (`.json` or `.yaml`) | `openapi.yaml` |
| `base-branch` | Base branch to compare against | `main` |
| `fail-on-breaking` | Fails the GitHub CI job if breaking changes exist | `true` |
| `license-key` | Commercial Pro license key for private repos (Free for OSS) | `""` |

---

## Licensing & Pricing

- **Open-Source Repositories**: **100% Free Forever** (Unlimited runs, no license key required).
- **Private Repositories**: Evaluation mode included. Commercial license keys available at [edgesaas.nexus-pulse.com](https://github.com/MilindChatrabhuji/edgesaas-starter-kit) ($19/mo or $79 lifetime team license).

## License

MIT License. Authored by [Milind Chatrabhuji](https://github.com/MilindChatrabhuji).
