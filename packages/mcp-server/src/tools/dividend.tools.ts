import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {getFactoryAddress, getLensAddress} from '../config.js';
import {
  getKeysDividendInfo,
  getPlatformDividendInfo,
  getClaimableTokens,
  getPlatformTokenAddress,
  claimKeysDividend,
  claimPlatformDividend,
  claimExternalTokens,
} from '../chain.js';

function toolResult(text: string, isError = false): {content: Array<{type: 'text'; text: string}>; isError?: boolean} {
  return {content: [{type: 'text', text}], ...(isError && {isError: true})};
}

const getKeysDividendInfoSchema = z.object({
  userAddress: z.string().describe('User wallet address'),
  roomAddresses: z.array(z.string()).describe('Room (InternalLaunchpad) contract addresses'),
});

export function registerGetKeysDividendInfo(server: McpServer): void {
  server.registerTool(
    'get_keys_dividend_info',
    {
      description:
        'Query keys dividend info (dividendsBNBAccrued, nextClaimTime) for user across rooms. Uses InternalLaunchpadLens.batchGetBalances.',
      inputSchema: getKeysDividendInfoSchema,
    },
    async (args) => {
      try {
        if (!getLensAddress()) {
          return toolResult('WEB4COOL_LENS_ADDRESS not configured', true);
        }
        const result = await getKeysDividendInfo(args.userAddress, args.roomAddresses);
        const formatted = result.map((r) => ({
          token: r.token,
          symbol: r.symbol,
          dividendsBNBAccrued: r.dividendsBNBAccrued.toString(),
          nextClaimTime: Number(r.nextClaimTime),
          canClaim: r.nextClaimTime === BigInt(0),
        }));
        return toolResult(JSON.stringify(formatted, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Get keys dividend info failed: ${msg}`, true);
      }
    },
  );
}

const claimKeysDividendSchema = z.object({
  roomAddress: z.string().describe('Room (InternalLaunchpad) contract address'),
});

export function registerClaimKeysDividend(server: McpServer): void {
  server.registerTool(
    'claim_keys_dividend',
    {
      description: 'Claim keys dividend for a room. Calls Factory.claimKeyDividends(launchpad).',
      inputSchema: claimKeysDividendSchema,
    },
    async (args) => {
      try {
        const result = await claimKeysDividend(args.roomAddress);
        return toolResult(JSON.stringify({txHash: result.txHash, message: 'Keys dividend claimed'}, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Claim keys dividend failed: ${msg}`, true);
      }
    },
  );
}

const getPlatformDividendInfoSchema = z.object({
  userAddress: z.string().describe('User wallet address'),
});

export function registerGetPlatformDividendInfo(server: McpServer): void {
  server.registerTool(
    'get_platform_dividend_info',
    {
      description:
        'Query platform token dividend info. Uses Web4coolToken.getAccountDividendsInfo. Platform token address is read from Factory.platformToken().',
      inputSchema: getPlatformDividendInfoSchema,
    },
    async (args) => {
      try {
        const factoryAddress = getFactoryAddress();
        if (!factoryAddress) {
          return toolResult('WEB4COOL_FACTORY_ADDRESS not configured', true);
        }
        const platformTokenAddress = await getPlatformTokenAddress();
        const result = await getPlatformDividendInfo(platformTokenAddress, args.userAddress);
        const formatted = {
          platformTokenAddress,
          withdrawableDividends: result.withdrawableDividends.toString(),
          nextClaimTime: Number(result.nextClaimTime),
          canClaim: result.nextClaimTime === BigInt(0),
        };
        return toolResult(JSON.stringify(formatted, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Get platform dividend info failed: ${msg}`, true);
      }
    },
  );
}

const emptySchema = z.object({});

export function registerClaimPlatformDividend(server: McpServer): void {
  server.registerTool(
    'claim_platform_dividend',
    {
      description:
        'Claim platform token dividend. Calls Web4coolToken.claim(). Uses current wallet. Platform token from Factory.platformToken().',
      inputSchema: emptySchema,
    },
    async () => {
      try {
        const platformTokenAddress = await getPlatformTokenAddress();
        const result = await claimPlatformDividend(platformTokenAddress);
        return toolResult(JSON.stringify({txHash: result.txHash, message: 'Platform dividend claimed'}, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Claim platform dividend failed: ${msg}`, true);
      }
    },
  );
}

const getClaimableTokensSchema = z.object({
  roomAddress: z.string().describe('Room (InternalLaunchpad) contract address'),
  userAddress: z.string().describe('User wallet address'),
});

export function registerGetClaimableTokens(server: McpServer): void {
  server.registerTool(
    'get_claimable_tokens',
    {
      description:
        'Query claimable external tokens for user in a graduated room. Uses InternalLaunchpad.getClaimableTokens(account).',
      inputSchema: getClaimableTokensSchema,
    },
    async (args) => {
      try {
        const result = await getClaimableTokens(args.roomAddress, args.userAddress);
        return toolResult(JSON.stringify({roomAddress: args.roomAddress, claimableTokens: result.toString()}, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Get claimable tokens failed: ${msg}`, true);
      }
    },
  );
}

const claimExternalTokensSchema = z.object({
  roomAddress: z.string().describe('Room (InternalLaunchpad) contract address'),
});

export function registerClaimExternalTokens(server: McpServer): void {
  server.registerTool(
    'claim_external_tokens',
    {
      description:
        'Claim external tokens after room graduation. Calls InternalLaunchpad.claimTokens(). Exchanges keys for external market tokens.',
      inputSchema: claimExternalTokensSchema,
    },
    async (args) => {
      try {
        const result = await claimExternalTokens(args.roomAddress);
        return toolResult(JSON.stringify({txHash: result.txHash, message: 'External tokens claimed'}, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Claim external tokens failed: ${msg}`, true);
      }
    },
  );
}

export function registerDividendTools(server: McpServer): void {
  registerGetKeysDividendInfo(server);
  registerClaimKeysDividend(server);
  registerGetPlatformDividendInfo(server);
  registerClaimPlatformDividend(server);
  registerGetClaimableTokens(server);
  registerClaimExternalTokens(server);
}
