/**
 * Authentication module for TouchPoints Swagger MCP.
 *
 * Protocol (discovered from Swagger UI source):
 *   Login:    POST /lcapi/tpsSupport/C1028/post
 *             body: {"vars.action":"login","vars.username":"...","vars.password":"..."}
 *             response: {"token":"..."}
 *
 *   Validate: POST /lcapi/tpsSupport/C1028/post
 *             body: {"vars.action":"validate","vars.token":"..."}
 *
 *   Auth header on all subsequent requests:
 *             X-TP-Auth: <token>
 */

const AUTH_HEADER = 'X-TP-Auth';
const AUTH_ENDPOINT = 'lcapi/tpsSupport/C1028/post';

/** @type {string | null} */
let token = null;

/** @type {string} */
let baseUrl = '';

/** @type {string} */
let username = '';

/** @type {string} */
let password = '';

/**
 * Initialize the auth module.
 * @param {object} config
 * @param {string} config.baseUrl - API base URL
 * @param {string} config.username
 * @param {string} config.password
 */
export function initAuth(config) {
  baseUrl = config.baseUrl.replace(/\/+$/, '') + '/';
  username = config.username;
  password = config.password;
  token = null;
}

/**
 * Authenticate against the TouchPoints API.
 * @returns {Promise<string>} The auth token
 */
export async function authenticate() {
  if (!username || !password) {
    throw new Error('SWAGGER_USERNAME and SWAGGER_PASSWORD environment variables are required');
  }

  const url = `${baseUrl}${AUTH_ENDPOINT}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'vars.action': 'login',
      'vars.username': username,
      'vars.password': password,
    }),
  });

  if (response.status === 429) {
    throw new Error('Too many login attempts. Please try again later.');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Authentication failed (HTTP ${response.status}): ${text}`);
  }

  const data = await response.json();

  if (!data || !data.token) {
    throw new Error('Authentication failed: no token in response');
  }

  token = data.token;
  return token;
}

/**
 * Get authorization headers for API requests.
 * Authenticates if no token is stored.
 * @returns {Promise<Record<string, string>>}
 */
export async function getAuthHeaders() {
  if (!token) {
    await authenticate();
  }
  return {
    'Content-Type': 'application/json',
    [AUTH_HEADER]: token,
  };
}

/**
 * Clear the stored token.
 */
export function clearToken() {
  token = null;
}

/**
 * Check if we currently have a token.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return token !== null;
}

/**
 * Make an authenticated POST request to a TouchPoints API endpoint.
 * All TP API calls are POST with JSON body, keys prefixed with "vars.".
 * Re-authenticates on 401.
 *
 * @param {string} endpoint - Relative endpoint path (e.g. "lcapi/tpsSupport/C1020/post")
 * @param {Record<string, any>} [payload] - Payload keys (auto-prefixed with "vars.")
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiPost(endpoint, payload = {}) {
  const url = `${baseUrl}${endpoint.replace(/^\//, '')}`;
  const headers = await getAuthHeaders();

  const prefixed = {};
  for (const [key, value] of Object.entries(payload)) {
    prefixed[`vars.${key}`] = value;
  }

  let response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(prefixed),
  });

  if (response.status === 401) {
    clearToken();
    const freshHeaders = await getAuthHeaders();
    response = await fetch(url, {
      method: 'POST',
      headers: freshHeaders,
      body: JSON.stringify(prefixed),
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`API call failed (HTTP ${response.status}): ${text}`);
  }

  return response.json();
}
