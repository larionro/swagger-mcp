/**
 * MCP tool definitions for the TouchPoints Swagger MCP server.
 *
 * Tools map to the TP custom API endpoints discovered from the Swagger UI source:
 *   - listControllers: C1020 registry
 *   - getControllerDetails: C1023 controllerMeta + C1024 controllerDocs
 *   - getModelTree: C1021 model tree
 *   - getEnumCatalog: C1022 enum definitions
 *   - getComponents: C1026 shared components
 *   - getWorkflows: C1025 workflow graph
 *   - exportSchema: C1029 schema export for a controller
 *   - getVersions: C1017 version list
 *   - getDiff: C1018 version diff
 *   - callEndpoint: execute arbitrary API call with auth
 */

import {
  fetchRegistry,
  fetchControllerMeta,
  fetchControllerDocs,
  fetchModelTree,
  fetchEnumCatalog,
  fetchComponents,
  fetchWorkflowGraph,
  fetchSchemaExport,
  fetchVersions,
  fetchDiff,
  invalidateCache,
} from './spec.js';
import { apiPost } from './auth.js';

/**
 * Tool definitions for MCP registration.
 */
export const toolDefinitions = [
  {
    name: 'listControllers',
    description: 'List all API controllers (endpoints) from the TouchPoints registry. Returns controller numbers, names, and summaries.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Optional: filter controllers by name, number, or description (case-insensitive)',
        },
        refresh: {
          type: 'boolean',
          description: 'Force a fresh fetch, bypassing cache',
        },
      },
    },
  },
  {
    name: 'getControllerDetails',
    description: 'Get detailed metadata and documentation for a specific controller by its number (e.g. 747). Returns request/response fields, models, and docs.',
    inputSchema: {
      type: 'object',
      properties: {
        controllerNumber: {
          type: 'string',
          description: 'The controller number (e.g. "747", "103", "644")',
        },
        includeDocs: {
          type: 'boolean',
          description: 'Also fetch documentation files for this controller (default: true)',
        },
      },
      required: ['controllerNumber'],
    },
  },
  {
    name: 'getModelTree',
    description: 'Fetch the model/schema tree showing all data models and their relationships. Optionally filter by controller number to get just that controller\'s response model tree.',
    inputSchema: {
      type: 'object',
      properties: {
        controllerNumber: {
          type: 'string',
          description: 'Optional: fetch model tree for a specific controller (e.g. "747")',
        },
        refresh: {
          type: 'boolean',
          description: 'Force a fresh fetch, bypassing cache',
        },
      },
    },
  },
  {
    name: 'getEnumCatalog',
    description: 'Fetch all enum definitions used across the API.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Optional: filter enums by name (case-insensitive)',
        },
        refresh: {
          type: 'boolean',
          description: 'Force a fresh fetch, bypassing cache',
        },
      },
    },
  },
  {
    name: 'getComponents',
    description: 'Fetch shared component definitions used across controllers.',
    inputSchema: {
      type: 'object',
      properties: {
        refresh: {
          type: 'boolean',
          description: 'Force a fresh fetch, bypassing cache',
        },
      },
    },
  },
  {
    name: 'getWorkflows',
    description: 'Fetch workflow graph data showing process flows and state machines.',
    inputSchema: {
      type: 'object',
      properties: {
        refresh: {
          type: 'boolean',
          description: 'Force a fresh fetch, bypassing cache',
        },
      },
    },
  },
  {
    name: 'exportSchema',
    description: 'Export the schema definition for a specific controller, including request params, route, and validations.',
    inputSchema: {
      type: 'object',
      properties: {
        controllerNumber: {
          type: 'string',
          description: 'The controller number (e.g. "747")',
        },
      },
      required: ['controllerNumber'],
    },
  },
  {
    name: 'getVersions',
    description: 'List available API versions.',
    inputSchema: {
      type: 'object',
      properties: {
        refresh: {
          type: 'boolean',
          description: 'Force a fresh fetch, bypassing cache',
        },
      },
    },
  },
  {
    name: 'getDiff',
    description: 'Get the diff between two API versions, showing what changed.',
    inputSchema: {
      type: 'object',
      properties: {
        fromVersion: {
          type: 'string',
          description: 'Source version to compare from',
        },
        toVersion: {
          type: 'string',
          description: 'Target version to compare to',
        },
      },
      required: ['fromVersion', 'toVersion'],
    },
  },
  {
    name: 'callEndpoint',
    description: 'Execute an authenticated API call to any TouchPoints endpoint. Payload keys are auto-prefixed with "vars." per the TP protocol.',
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          description: 'Relative endpoint path (e.g. "lcapi/tpsSupport/C1020/post" or "lcapi/C103/post")',
        },
        payload: {
          type: 'object',
          description: 'Request payload (keys will be auto-prefixed with "vars.")',
        },
      },
      required: ['endpoint'],
    },
  },
];

/**
 * Handle a tool call.
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments
 * @returns {Promise<object>} MCP tool result
 */
export async function handleToolCall(name, args) {
  try {
    switch (name) {
      case 'listControllers':
        return await handleListControllers(args);
      case 'getControllerDetails':
        return await handleGetControllerDetails(args);
      case 'getModelTree':
        return await handleGetModelTree(args);
      case 'getEnumCatalog':
        return await handleGetEnumCatalog(args);
      case 'getComponents':
        return await handleGetComponents(args);
      case 'getWorkflows':
        return await handleGetWorkflows(args);
      case 'exportSchema':
        return await handleExportSchema(args);
      case 'getVersions':
        return await handleGetVersions(args);
      case 'getDiff':
        return await handleGetDiff(args);
      case 'callEndpoint':
        return await handleCallEndpoint(args);
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error in ${name}: ${err.message}` }], isError: true };
  }
}

function textResult(data) {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
}

async function handleListControllers({ search, refresh }) {
  if (refresh) invalidateCache();
  const data = await fetchRegistry(refresh);

  if (search) {
    const q = search.toLowerCase();
    const filtered = filterData(data, q);
    return textResult(filtered);
  }

  return textResult(data);
}

async function handleGetControllerDetails({ controllerNumber, includeDocs = true }) {
  // Fetch registry, meta, model tree, and schema in parallel for complete details
  const [registry, meta, modelTree, schema] = await Promise.all([
    fetchRegistry(),
    fetchControllerMeta(controllerNumber),
    fetchModelTree(controllerNumber).catch(() => null),
    fetchSchemaExport(controllerNumber).catch(() => null),
  ]);

  // Find registry entry for this controller
  const items = Array.isArray(registry) ? registry : (registry.controllers || registry.items || registry.data || []);
  const registryEntry = items.find(c => String(c.number || c.controllerNumber || '') === String(controllerNumber)) || null;

  const result = { registryEntry, meta, modelTree, schema };

  if (includeDocs) {
    try {
      result.docs = await fetchControllerDocs(controllerNumber);
    } catch {
      result.docs = null;
    }
  }

  return textResult(result);
}

async function handleGetModelTree({ controllerNumber, refresh }) {
  if (refresh) invalidateCache();
  return textResult(await fetchModelTree(controllerNumber, refresh));
}

async function handleGetEnumCatalog({ search, refresh }) {
  if (refresh) invalidateCache();
  const data = await fetchEnumCatalog(refresh);

  if (search) {
    const q = search.toLowerCase();
    const filtered = filterData(data, q);
    return textResult(filtered);
  }

  return textResult(data);
}

async function handleGetComponents({ refresh }) {
  if (refresh) invalidateCache();
  return textResult(await fetchComponents(refresh));
}

async function handleGetWorkflows({ refresh }) {
  if (refresh) invalidateCache();
  return textResult(await fetchWorkflowGraph(refresh));
}

async function handleExportSchema({ controllerNumber }) {
  return textResult(await fetchSchemaExport(controllerNumber));
}

async function handleGetVersions({ refresh }) {
  if (refresh) invalidateCache();
  return textResult(await fetchVersions(refresh));
}

async function handleGetDiff({ fromVersion, toVersion }) {
  return textResult(await fetchDiff(fromVersion, toVersion));
}

async function handleCallEndpoint({ endpoint, payload = {} }) {
  return textResult(await apiPost(endpoint, payload));
}

/**
 * Simple recursive filter: if data is an array, filter items containing the query.
 * If data is an object, return it as-is (caller should interpret).
 */
function filterData(data, query) {
  if (Array.isArray(data)) {
    return data.filter((item) => JSON.stringify(item).toLowerCase().includes(query));
  }
  return data;
}
