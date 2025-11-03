/**
 * Token management service
 */

import { buildApiUrl } from '@/config/api';

export interface Token {
  token_id: string;
  created_at: number;
}

export interface TokenListResponse {
  tokens: Token[];
}

export class TokenService {
  /**
   * Generate a new API token
   */
  static async generateToken(): Promise<Token> {
    const response = await fetch(buildApiUrl('/tokens/generate'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to generate token: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List all tokens for the authenticated user
   */
  static async listTokens(): Promise<TokenListResponse> {
    const response = await fetch(buildApiUrl('/tokens/list'), {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list tokens: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete a specific token
   */
  static async deleteToken(tokenId: string): Promise<void> {
    const response = await fetch(buildApiUrl(`/tokens/${tokenId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete token: ${response.statusText}`);
    }
  }
}
