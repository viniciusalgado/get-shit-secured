#!/usr/bin/env node
/**
 * MCP Server — Local stdio entrypoint for get-shit-secured.
 *
 * Exposes the corpus snapshot, consultation planner, and compliance
 * validator as deterministic MCP tools and resources over stdio.
 *
 * Usage:
 *   node dist/mcp/server.js --corpus-path data/corpus/owasp-corpus.snapshot.json
 *   GSS_CORPUS_PATH=/path/to/corpus.json node dist/mcp/server.js
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { loadCorpusSnapshot, type LoadedSnapshot } from '../corpus/snapshot-loader.js';
import { isCorpusSnapshot } from '../corpus/schema.js';

import { computeDiagnostics, type CorpusDiagnostics } from './diagnostics.js';
import { readResource, buildResourceList, type ResourceEntry } from './resources.js';
import { handleConsultationPlan, type ConsultationPlanToolInput } from './tools/consultation-plan.js';
import { handleValidateCoverage, type ValidateCoverageToolInput } from './tools/validate-coverage.js';
import { handleReadDoc, type ReadDocToolInput } from './tools/read-doc.js';
import { handleRelatedDocs, type RelatedDocsToolInput } from './tools/related-docs.js';
import { handleSearchDocs, type SearchDocsToolInput } from './tools/search-docs.js';
import { handleListWorkflows, handleListStacks } from './tools/diagnostics.js';

// ---------------------------------------------------------------------------
// Snapshot path resolution
// ---------------------------------------------------------------------------

function resolveSnapshotPath(): string {
  // 1. CLI argument
  const argIdx = process.argv.indexOf('--corpus-path');
  if (argIdx !== -1 && process.argv[argIdx + 1]) {
    return resolve(process.argv[argIdx + 1]!);
  }

  // 2. Environment variable
  const envPath = process.env['GSS_CORPUS_PATH'];
  if (envPath) {
    return resolve(envPath);
  }

  // 3. Relative to this file (dist/mcp/server.js -> ../corpus/owasp-corpus.json)
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const relativePath = resolve(thisDir, '..', 'corpus', 'owasp-corpus.json');
  return relativePath;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: 'get_workflow_consultation_plan',
    description:
      'Compute a deterministic consultation plan for a security workflow. Returns required, optional, and followup documents to consult.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workflowId: {
          type: 'string' as const,
          description: 'Workflow ID (e.g., "audit", "security-review")',
          enum: [
            'security-review', 'map-codebase', 'threat-model', 'audit',
            'validate-findings', 'plan-remediation', 'execute-remediation',
            'verify', 'report',
          ],
        },
        stacks: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Detected stack tags (e.g., ["nodejs", "python"])',
        },
        issueTags: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Issue classification tags (e.g., ["xss", "sql-injection"])',
        },
        changedFiles: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Changed file paths for file-conditioned bindings',
        },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'validate_security_consultation',
    description:
      'Validate that a workflow consulted the required security documents. Returns pass/warn/fail coverage status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workflowId: {
          type: 'string' as const,
          description: 'Workflow ID',
          enum: [
            'security-review', 'map-codebase', 'threat-model', 'audit',
            'validate-findings', 'plan-remediation', 'execute-remediation',
            'verify', 'report',
          ],
        },
        consultedDocs: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Document IDs that were actually consulted',
        },
        stacks: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Stack tags used during consultation',
        },
        issueTags: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Issue tags used during consultation',
        },
        changedFiles: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Changed file paths',
        },
      },
      required: ['workflowId', 'consultedDocs'],
    },
  },
  {
    name: 'read_security_doc',
    description:
      'Retrieve a security document by canonical ID or security:// URI. Supports alias resolution.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string' as const,
          description: 'Canonical document ID (e.g., "sql-injection-prevention") or alias (e.g., "xss")',
        },
        uri: {
          type: 'string' as const,
          description: 'security:// URI (e.g., "security://owasp/cheatsheet/sql-injection-prevention")',
        },
      },
    },
  },
  {
    name: 'get_related_security_docs',
    description:
      'Get documents related to a given security document via bidirectional corpus graph lookup.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string' as const,
          description: 'Source document ID',
        },
        reason: {
          type: 'string' as const,
          description: 'Why the caller is asking (for logging)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_security_docs',
    description:
      'Search the security document corpus. Use when you need fuzzy/partial matching, not as the primary consultation path.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
          description: 'Search terms',
        },
        sourceTypes: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Filter by sourceType (e.g., ["owasp-cheatsheet"])',
        },
        workflowId: {
          type: 'string' as const,
          description: 'Filter by workflow binding',
        },
        stack: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Filter by stack tag',
        },
        issueTags: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Filter by issue type',
        },
        topK: {
          type: 'number' as const,
          description: 'Max results (default: 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_supported_workflows',
    description: 'List all workflows that have at least one required document in the corpus.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'list_supported_stacks',
    description: 'List all stack tags present in the corpus.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const snapshotPath = resolveSnapshotPath();

  // Load corpus snapshot
  let loaded: LoadedSnapshot;
  try {
    const raw = readFileSync(snapshotPath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!isCorpusSnapshot(parsed)) {
      process.stderr.write(`Error: Invalid corpus snapshot at ${snapshotPath}\n`);
      process.stderr.write('The file exists but does not match the expected schema.\n');
      process.exit(1);
    }

    loaded = loadCorpusSnapshot(snapshotPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: Failed to load corpus snapshot at ${snapshotPath}\n`);
    process.stderr.write(`${msg}\n`);
    process.stderr.write('\nSet GSS_CORPUS_PATH or use --corpus-path to specify the snapshot.\n');
    process.exit(1);
  }

  const diag = computeDiagnostics(loaded);
  const resourceList = buildResourceList(diag);

  process.stderr.write(
    `[gss-mcp] Loaded corpus v${diag.corpusVersion} (${diag.totalDocs} docs, ` +
    `${diag.supportedWorkflows.length} workflows, ${diag.supportedStacks.length} stacks)\n`,
  );

  // Create MCP server
  const server = new Server(
    {
      name: 'gss-security-docs',
      version: diag.corpusVersion,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  // --- Resources ---

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: resourceList.map(r => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    try {
      const content = readResource(uri, loaded, diag);
      return {
        contents: [
          {
            uri: content.uri,
            mimeType: content.mimeType,
            text: content.text,
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        contents: [],
        isError: true,
      };
    }
  });

  // --- Tools ---

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOL_DEFINITIONS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const input: unknown = args ?? {};

    try {
      switch (name) {
        case 'get_workflow_consultation_plan': {
          const result = handleConsultationPlan(
            input as unknown as ConsultationPlanToolInput,
            loaded,
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'validate_security_consultation': {
          const result = handleValidateCoverage(
            input as ValidateCoverageToolInput,
            loaded,
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'read_security_doc': {
          const doc = handleReadDoc(input as ReadDocToolInput, loaded);
          if (!doc) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: 'Document not found', input }, null, 2),
                },
              ],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(doc, null, 2),
              },
            ],
          };
        }

        case 'get_related_security_docs': {
          const docs = handleRelatedDocs(input as RelatedDocsToolInput, loaded);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(docs, null, 2),
              },
            ],
          };
        }

        case 'search_security_docs': {
          const results = handleSearchDocs(input as SearchDocsToolInput, loaded);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        }

        case 'list_supported_workflows': {
          const result = handleListWorkflows(diag);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'list_supported_stacks': {
          const result = handleListStacks(diag);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Unknown tool: ${name}` }),
              },
            ],
            isError: true,
          };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: msg, tool: name }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write('[gss-mcp] Server started on stdio\n');
}

main().catch((err) => {
  process.stderr.write(`[gss-mcp] Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
