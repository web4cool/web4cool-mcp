import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {apiClient} from '../api-client.js';

function toolResult(text: string, isError = false): {content: Array<{type: 'text'; text: string}>; isError?: boolean} {
  return {content: [{type: 'text', text}], ...(isError && {isError: true})};
}

const paginationSchema = z.object({
  page: z.number().optional().describe('Page number'),
  pageSize: z.number().optional().describe('Page size'),
});

const getTokenSchema = z.object({
  address: z.string().describe('Token contract address'),
});

const getHoldersSchema = z.object({
  tokenAddress: z.string().describe('Token/room contract address'),
  page: z.number().optional(),
  pageSize: z.number().optional(),
});

export function registerGetMyTokens(server: McpServer): void {
  server.registerTool(
    'get_my_tokens',
    {
      description:
        'Get rooms (internal launchpads) where the current wallet holds keys. Returns token address, symbol, roundId, lastInteractionAt. Requires login.',
      inputSchema: paginationSchema,
    },
    (async (args?: {page?: number; pageSize?: number}) => {
      try {
        const page = args?.page ?? 1;
        const pageSize = args?.pageSize ?? 10;
        const res = await apiClient.get<{items: unknown[]; total: number; page: number; pageSize: number}>(
          `/tokens/my?page=${page}&pageSize=${pageSize}`,
          true,
        );
        return toolResult(JSON.stringify(res, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Get my tokens failed: ${msg}`, true);
      }
    }) as never,
  );
}

export function registerGetToken(server: McpServer): void {
  server.registerTool(
    'get_token',
    {
      description: 'Get token details by address.',
      inputSchema: getTokenSchema,
    },
    (async ({address}: {address?: string}) => {
      try {
        const res = await apiClient.get<unknown>(`/tokens/${address}`, false);
        return toolResult(JSON.stringify(res, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Get token failed: ${msg}`, true);
      }
    }) as never,
  );
}

export function registerGetHolders(server: McpServer): void {
  server.registerTool(
    'get_holders',
    {
      description: 'Get room key holders (players) by token address.',
      inputSchema: getHoldersSchema,
    },
    (async ({tokenAddress, page = 1, pageSize = 20}: {tokenAddress?: string; page?: number; pageSize?: number}) => {
      try {
        const res = await apiClient.get<{items: unknown[]; total: number; page: number; pageSize: number}>(
          `/rooms/${tokenAddress}/holders?page=${page}&pageSize=${pageSize}`,
          false,
        );
        return toolResult(JSON.stringify(res, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Get holders failed: ${msg}`, true);
      }
    }) as never,
  );
}
