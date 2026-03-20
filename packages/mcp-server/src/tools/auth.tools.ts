import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {apiClient} from '../api-client.js';
import {getWallet} from '../config.js';
import {clearToken, login} from '../auth.js';

function toolResult(text: string, isError = false): {content: Array<{type: 'text'; text: string}>; isError?: boolean} {
  return {content: [{type: 'text', text}], ...(isError && {isError: true})};
}

const addressSchema = z.object({
  address: z.string().describe('Ethereum wallet address'),
});

const walletLoginSchema = z.object({
  address: z.string().describe('Wallet address'),
  message: z.string().describe('Message that was signed'),
  signature: z.string().describe('Signature hex'),
});

export function registerGetWalletNonce(server: McpServer): void {
  server.registerTool(
    'get_wallet_nonce',
    {
      description: 'Get nonce for wallet address (for login flow).',
      inputSchema: addressSchema,
    },
    async ({address}: {address?: string}) => {
      try {
        const res = await apiClient.get<{nonce: string}>(`/auth/wallet/nonce?address=${address}`, false);
        return toolResult(JSON.stringify(res, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Get nonce failed: ${msg}`, true);
      }
    },
  );
}

export function registerWalletLogin(server: McpServer): void {
  server.registerTool(
    'wallet_login',
    {
      description: 'Login with wallet signature. Use get_wallet_nonce first, sign the message, then call this.',
      inputSchema: walletLoginSchema,
    },
    async (args: {address?: string; message?: string; signature?: string}) => {
      try {
        const res = await apiClient.post<{user: unknown; accessToken: string}>('/auth/wallet/login', args, false);
        return toolResult(JSON.stringify({...res, accessToken: '[REDACTED]'}, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Login failed: ${msg}`, true);
      }
    },
  );
}

const emptySchema = z.object({});

export function registerMcpReLogin(server: McpServer): void {
  server.registerTool(
    'mcp_re_login',
    {
      description:
        'Clear cached auth token and re-login with MCP wallet. Use when getting 401 Invalid/expired nonce. Restart MCP server after backend nonce reset if needed.',
      inputSchema: emptySchema,
    },
    async () => {
      try {
        clearToken();
        const wallet = await getWallet();
        await login(wallet);
        return toolResult(JSON.stringify({ok: true, message: 'Re-login successful', address: wallet.address}));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Re-login failed: ${msg}`, true);
      }
    },
  );
}
