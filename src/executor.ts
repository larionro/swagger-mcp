import axios, { type AxiosRequestConfig } from "axios";
import type { OperationInfo } from "./types.js";

/**
 * Executes an HTTP request for the given operation with the supplied arguments.
 *
 * @param operation  The resolved operation info from the transformer.
 * @param args       Flat map of argument values keyed by parameter name.
 * @param baseUrl    The resolved base URL (from spec or CLI override).
 * @param headers    Extra headers to attach to every request.
 * @returns A plain-text representation of the response (JSON-stringified body or
 *          plain text) plus the HTTP status code.
 */
export async function executeOperation(
  operation: OperationInfo,
  args: Record<string, unknown>,
  baseUrl: string,
  headers: Record<string, string> = {},
): Promise<string> {
  let urlPath = operation.path;

  // Replace path parameters.
  for (const param of operation.parameters) {
    if (param.in === "path") {
      const value = args[param.name];
      if (value !== undefined && value !== null) {
        urlPath = urlPath.replace(
          `{${param.name}}`,
          encodeURIComponent(String(value)),
        );
      }
    }
  }

  const url = `${baseUrl.replace(/\/$/, "")}${urlPath}`;

  const queryParams: Record<string, unknown> = {};
  for (const param of operation.parameters) {
    if (param.in === "query" && args[param.name] !== undefined) {
      queryParams[param.name] = args[param.name];
    }
  }

  const requestHeaders: Record<string, string> = { ...headers };
  for (const param of operation.parameters) {
    if (param.in === "header" && args[param.name] !== undefined) {
      requestHeaders[param.name] = String(args[param.name]);
    }
  }

  // Determine request body.
  let data: unknown = undefined;
  if (operation.requestBody && args["body"] !== undefined) {
    data = args["body"];
    if (operation.contentType && !requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = operation.contentType;
    }
  }

  const config: AxiosRequestConfig = {
    method: operation.method,
    url,
    params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    headers: requestHeaders,
    data,
    // Don't throw on non-2xx; we want to return the error to the LLM.
    validateStatus: () => true,
  };

  const response = await axios.request(config);

  const statusLine = `HTTP ${response.status} ${response.statusText}`;
  const body =
    typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data, null, 2);

  return `${statusLine}\n\n${body}`;
}
