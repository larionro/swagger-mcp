/**
 * TouchPoints API data fetcher.
 * Fetches fresh data from the live TP endpoints — no local file fallback.
 * In-memory cache with TTL to avoid excessive re-fetching.
 *
 * TP API endpoints (all POST, all require X-TP-Auth header):
 *   C1020 - registry:       list of all controllers (the main "spec")
 *   C1023 - controllerMeta: metadata for a specific controller
 *   C1024 - controllerDocs: documentation for a specific controller
 *   C1021 - modelTree:      model/schema tree
 *   C1022 - enumCatalog:    enum definitions
 *   C1026 - components:     shared components
 *   C1025 - workflowGraph:  workflow definitions
 *   C1029 - schemaExport:   export schema for a controller
 *   C1017 - versions:       version list
 *   C1018 - diff:           version diff
 */

import { apiPost } from './auth.js';

const ENDPOINTS = {
  registry:       'lcapi/tpsSupport/C1020/post',
  modelTree:      'lcapi/tpsSupport/C1021/post',
  enumCatalog:    'lcapi/tpsSupport/C1022/post',
  controllerMeta: 'lcapi/tpsSupport/C1023/post',
  controllerDocs: 'lcapi/tpsSupport/C1024/post',
  workflowGraph:  'lcapi/tpsSupport/C1025/post',
  components:     'lcapi/tpsSupport/C1026/post',
  sprintNotes:    'lcapi/tpsSupport/C1027/post',
  versions:       'lcapi/tpsSupport/C1017/post',
  diff:           'lcapi/tpsSupport/C1018/post',
  schemaExport:   'lcapi/tpsSupport/C1029/post',
};

/** In-memory cache: { key → { data, fetchedAt } } */
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data or fetch fresh.
 * @param {string} cacheKey
 * @param {() => Promise<any>} fetcher
 * @param {boolean} forceRefresh
 * @returns {Promise<any>}
 */
async function cached(cacheKey, fetcher, forceRefresh = false) {
  if (!forceRefresh) {
    const entry = cache.get(cacheKey);
    if (entry && (Date.now() - entry.fetchedAt) < CACHE_TTL_MS) {
      return entry.data;
    }
  }
  const data = await fetcher();
  cache.set(cacheKey, { data, fetchedAt: Date.now() });
  return data;
}

/**
 * Fetch the controller registry (list of all controllers/endpoints).
 * @param {boolean} [forceRefresh]
 * @returns {Promise<any>}
 */
export async function fetchRegistry(forceRefresh = false) {
  return cached('registry', () => apiPost(ENDPOINTS.registry), forceRefresh);
}

/**
 * Fetch metadata for a specific controller by number.
 * @param {string|number} controllerNumber - e.g. "747" or 747
 * @param {boolean} [forceRefresh]
 * @returns {Promise<any>}
 */
export async function fetchControllerMeta(controllerNumber, forceRefresh = false) {
  return cached(
    `meta:${controllerNumber}`,
    () => apiPost(ENDPOINTS.controllerMeta, { cNum: String(controllerNumber) }),
    forceRefresh
  );
}

/**
 * Fetch documentation file list for a specific controller.
 * C1024 requires action='list' + controllerNumber.
 * @param {string|number} controllerNumber
 * @param {boolean} [forceRefresh]
 * @returns {Promise<any>}
 */
export async function fetchControllerDocs(controllerNumber, forceRefresh = false) {
  return cached(
    `docs:${controllerNumber}`,
    () => apiPost(ENDPOINTS.controllerDocs, { action: 'list', controllerNumber: String(controllerNumber) }),
    forceRefresh
  );
}

/**
 * Fetch the model/schema tree.
 * If controllerNumber is provided, fetches the model tree for that specific controller.
 * @param {string|number} [controllerNumber]
 * @param {boolean} [forceRefresh]
 * @returns {Promise<any>}
 */
export async function fetchModelTree(controllerNumber, forceRefresh = false) {
  if (controllerNumber) {
    return cached(
      `modelTree:${controllerNumber}`,
      () => apiPost(ENDPOINTS.modelTree, { cNum: String(controllerNumber) }),
      forceRefresh
    );
  }
  return cached('modelTree', () => apiPost(ENDPOINTS.modelTree), forceRefresh);
}

/**
 * Fetch the enum catalog.
 * @param {boolean} [forceRefresh]
 * @returns {Promise<any>}
 */
export async function fetchEnumCatalog(forceRefresh = false) {
  return cached('enumCatalog', () => apiPost(ENDPOINTS.enumCatalog), forceRefresh);
}

/**
 * Fetch shared components.
 * @param {boolean} [forceRefresh]
 * @returns {Promise<any>}
 */
export async function fetchComponents(forceRefresh = false) {
  return cached('components', () => apiPost(ENDPOINTS.components), forceRefresh);
}

/**
 * Fetch workflow graph data.
 * @param {boolean} [forceRefresh]
 * @returns {Promise<any>}
 */
export async function fetchWorkflowGraph(forceRefresh = false) {
  return cached('workflowGraph', () => apiPost(ENDPOINTS.workflowGraph), forceRefresh);
}

/**
 * Export schema for a specific controller (request params, route, validations).
 * @param {string|number} controllerNumber
 * @returns {Promise<any>}
 */
export async function fetchSchemaExport(controllerNumber) {
  return cached(
    `schema:${controllerNumber}`,
    () => apiPost(ENDPOINTS.schemaExport, { cNum: String(controllerNumber) })
  );
}

/**
 * Fetch version list.
 * @param {boolean} [forceRefresh]
 * @returns {Promise<any>}
 */
export async function fetchVersions(forceRefresh = false) {
  return cached('versions', () => apiPost(ENDPOINTS.versions), forceRefresh);
}

/**
 * Fetch diff between versions.
 * @param {string} fromVersion
 * @param {string} toVersion
 * @returns {Promise<any>}
 */
export async function fetchDiff(fromVersion, toVersion) {
  return apiPost(ENDPOINTS.diff, { from: fromVersion, to: toVersion });
}

/**
 * Invalidate all cached data.
 */
export function invalidateCache() {
  cache.clear();
}
