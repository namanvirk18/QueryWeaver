/* eslint-disable @typescript-eslint/no-explicit-any */

import { APIRequestContext, APIResponse } from "@playwright/test";
import { getRequest, postRequest, deleteRequest } from "../../infra/api/apiRequests";
import type {
  AuthStatusResponse,
  LoginResponse,
  SignupResponse,
  LogoutResponse,
  GraphsListResponse,
  GraphDataResponse,
  GraphUploadResponse,
  DeleteGraphResponse,
  StreamMessage,
  TokenListResponse,
  GenerateTokenResponse,
  DeleteTokenResponse,
} from "./apiResponses";

// ==================== AUTHENTICATION ENDPOINTS ====================

/**
 * Check authentication status
 * GET /auth-status
 */
export async function getAuthStatus(
  baseUrl: string,
  requestContext?: APIRequestContext
): Promise<AuthStatusResponse> {
  try {
    const response = await getRequest(
      `${baseUrl}/auth-status`,
      undefined,
      undefined,
      requestContext
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to get auth status. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Login with email and password
 * POST /login/email
 */
export async function loginWithEmail(
  baseUrl: string,
  email: string,
  password: string,
  requestContext?: APIRequestContext
): Promise<LoginResponse> {
  try {
    const response = await postRequest(
      `${baseUrl}/login/email`,
      { email, password },
      requestContext
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to login with email. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Signup with email and password
 * POST /signup/email
 */
export async function signupWithEmail(
  baseUrl: string,
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  requestContext?: APIRequestContext
): Promise<SignupResponse> {
  try {
    const response = await postRequest(
      `${baseUrl}/signup/email`,
      { firstName, lastName, email, password },
      requestContext
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to signup with email. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Logout
 * POST /logout
 */
export async function logout(
  baseUrl: string,
  requestContext?: APIRequestContext
): Promise<LogoutResponse> {
  try {
    const response = await postRequest(
      `${baseUrl}/logout`,
      undefined,
      requestContext
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to logout. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Get Google OAuth login URL
 * GET /login/google
 */
export function getGoogleLoginUrl(baseUrl: string): string {
  return `${baseUrl}/login/google`;
}

/**
 * Get GitHub OAuth login URL
 * GET /login/github
 */
export function getGithubLoginUrl(baseUrl: string): string {
  return `${baseUrl}/login/github`;
}

// ==================== GRAPH/DATABASE MANAGEMENT ENDPOINTS ====================

/**
 * Get list of all graphs for authenticated user
 * GET /graphs
 */
export async function getGraphs(
  baseUrl: string,
  requestContext?: APIRequestContext
): Promise<GraphsListResponse> {
  try {
    const response = await getRequest(
      `${baseUrl}/graphs`,
      undefined,
      undefined,
      requestContext
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to get graphs. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Get graph schema data (nodes and links)
 * GET /graphs/{graph_id}/data
 */
export async function getGraphData(
  baseUrl: string,
  graphId: string,
  requestContext?: APIRequestContext
): Promise<GraphDataResponse> {
  try {
    const response = await getRequest(
      `${baseUrl}/graphs/${graphId}/data`,
      undefined,
      undefined,
      requestContext
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to get graph data for ${graphId}. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Upload graph data file (JSON, CSV, XML)
 * POST /graphs
 */
export async function uploadGraph(
  baseUrl: string,
  filePath: string,
  database?: string,
  description?: string,
  requestContext?: APIRequestContext
): Promise<GraphUploadResponse> {
  try {
    const formData: Record<string, string> = {
      file: filePath,
    };

    if (database) formData.database = database;
    if (description) formData.description = description;

    const response = await postRequest(
      `${baseUrl}/graphs`,
      formData,
      requestContext,
      { "Content-Type": "multipart/form-data" }
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to upload graph. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Query a database with natural language (streaming)
 * POST /graphs/{graph_id}
 * Returns streaming SSE response
 */
export async function queryGraph(
  baseUrl: string,
  graphId: string,
  chat: string[],
  result?: string[] | null,
  instructions?: string,
  requestContext?: APIRequestContext
): Promise<APIResponse> {
  try {
    const body = {
      chat,
      result: result || null,
      instructions: instructions || undefined,
    };

    const response = await postRequest(
      `${baseUrl}/graphs/${graphId}`,
      body,
      requestContext,
      { "Content-Type": "application/json" }
    );

    return response;
  } catch (error) {
    throw new Error(
      `Failed to query graph ${graphId}. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Parse streaming SSE response
 * Helper to parse streaming messages separated by |||FALKORDB_MESSAGE_BOUNDARY|||
 */
export async function parseStreamingResponse(
  response: APIResponse
): Promise<StreamMessage[]> {
  try {
    const body = await response.text();
    const messages = body
      .split("|||FALKORDB_MESSAGE_BOUNDARY|||")
      .filter((msg) => msg.trim())
      .map((msg) => JSON.parse(msg.trim()));
    return messages;
  } catch (error) {
    throw new Error(
      `Failed to parse streaming response. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Confirm destructive SQL operation
 * POST /graphs/{graph_id}/confirm
 */
export async function confirmGraphOperation(
  baseUrl: string,
  graphId: string,
  sqlQuery: string,
  confirmation: string,
  chat: any[] = [],
  requestContext?: APIRequestContext
): Promise<APIResponse> {
  try {
    const body = {
      sql_query: sqlQuery,
      confirmation,
      chat,
    };

    const response = await postRequest(
      `${baseUrl}/graphs/${graphId}/confirm`,
      body,
      requestContext,
      { "Content-Type": "application/json" }
    );

    return response;
  } catch (error) {
    throw new Error(
      `Failed to confirm operation for graph ${graphId}. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Refresh graph schema
 * POST /graphs/{graph_id}/refresh
 */
export async function refreshGraphSchema(
  baseUrl: string,
  graphId: string,
  requestContext?: APIRequestContext
): Promise<APIResponse> {
  try {
    const response = await postRequest(
      `${baseUrl}/graphs/${graphId}/refresh`,
      undefined,
      requestContext,
      { "Content-Type": "application/json" }
    );

    return response;
  } catch (error) {
    throw new Error(
      `Failed to refresh schema for graph ${graphId}. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Delete a graph
 * DELETE /graphs/{graph_id}
 */
export async function deleteGraph(
  baseUrl: string,
  graphId: string
): Promise<DeleteGraphResponse> {
  try {
    const response = await deleteRequest(
      `${baseUrl}/graphs/${graphId}`,
      undefined,
      undefined
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to delete graph ${graphId}. \n Error: ${(error as Error).message}`
    );
  }
}

// ==================== DATABASE CONNECTION ENDPOINTS ====================

/**
 * Connect to external database using connection URL
 * POST /database
 * Supports PostgreSQL and MySQL
 */
export async function connectDatabase(
  baseUrl: string,
  connectionUrl: string,
  requestContext?: APIRequestContext
): Promise<APIResponse> {
  try {
    const body = {
      url: connectionUrl,
    };

    const response = await postRequest(
      `${baseUrl}/database`,
      body,
      requestContext,
      { "Content-Type": "application/json" }
    );

    return response;
  } catch (error) {
    throw new Error(
      `Failed to connect to database. \n Error: ${(error as Error).message}`
    );
  }
}

// ==================== TOKEN MANAGEMENT ENDPOINTS ====================

/**
 * Generate a new API token
 * POST /tokens/generate
 */
export async function generateToken(
  baseUrl: string,
  requestContext?: APIRequestContext
): Promise<GenerateTokenResponse> {
  try {
    const response = await postRequest(
      `${baseUrl}/tokens/generate`,
      undefined,
      requestContext
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to generate token. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * List all tokens for authenticated user
 * GET /tokens/list
 */
export async function listTokens(
  baseUrl: string,
  requestContext?: APIRequestContext
): Promise<TokenListResponse> {
  try {
    const response = await getRequest(
      `${baseUrl}/tokens/list`,
      undefined,
      undefined,
      requestContext
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to list tokens. \n Error: ${(error as Error).message}`
    );
  }
}

/**
 * Delete a specific token
 * DELETE /tokens/{token_id}
 */
export async function deleteToken(
  baseUrl: string,
  tokenId: string
): Promise<DeleteTokenResponse> {
  try {
    const response = await deleteRequest(
      `${baseUrl}/tokens/${tokenId}`,
      undefined,
      undefined
    );
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to delete token ${tokenId}. \n Error: ${(error as Error).message}`
    );
  }
}
