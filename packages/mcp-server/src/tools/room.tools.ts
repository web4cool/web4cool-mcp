import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {apiClient} from '../api-client.js';
import {getFactoryAddress} from '../config.js';
import {createRoomOnChain, buyKeys} from '../chain.js';

function toolResult(text: string, isError = false): {content: Array<{type: 'text'; text: string}>; isError?: boolean} {
  return {content: [{type: 'text', text}], ...(isError && {isError: true})};
}

const createRoomSchema = z.object({
  name: z.string().describe('Token name'),
  symbol: z.string().describe('Token symbol'),
  description: z.string().describe('Token description'),
  logoUrl: z.string().describe('Token logo URL'),
  website: z.string().optional().describe('Token website URL'),
  twitter: z.string().optional().describe('Twitter URL'),
  telegram: z.string().optional().describe('Telegram URL'),
  tags: z.array(z.string()).optional().describe('Token tags'),
  taxEnabled: z.boolean().optional().describe('Enable tax'),
  taxRate: z.number().optional().describe('Tax rate (0-100)'),
  taxDistribution: z
    .object({
      marketing: z.number(),
      burn: z.number(),
      dividend: z.number(),
      liquidity: z.number(),
    })
    .optional()
    .describe('Tax distribution: marketing, burn, dividend, liquidity (sum=10)'),
  marketingWallet: z.string().optional().describe('Marketing wallet address'),
  dividendMinHolding: z.string().optional().describe('Min holding for dividend'),
});

type CreateRoomArgs = {
  name?: string;
  symbol?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  tags?: string[];
  taxEnabled?: boolean;
  taxRate?: number;
  taxDistribution?: {marketing?: number; burn?: number; dividend?: number; liquidity?: number};
  marketingWallet?: string;
  dividendMinHolding?: string;
};

export function registerCreateRoom(server: McpServer): void {
  server.registerTool(
    'create_room',
    {
      description:
        'Create a launchpad room. Calls backend pre-create then sends createLaunchpadDeterministic tx. Requires WEB4COOL_FACTORY_ADDRESS.',
      inputSchema: createRoomSchema,
    },
    (async (args: CreateRoomArgs) => {
      try {
        const factoryAddress = getFactoryAddress();
        if (!factoryAddress) {
          return toolResult('WEB4COOL_FACTORY_ADDRESS not configured. Set it in .env to create rooms on chain.', true);
        }

        const preCreate = await apiClient.post<{address: string; salt: string; signature: string}>(
          '/tokens/pre-create',
          {
            description: args.description ?? '',
            logoUrl: args.logoUrl ?? '',
            website: args.website,
            twitter: args.twitter,
            telegram: args.telegram,
            tags: args.tags,
            tax: args.taxEnabled ? (args.taxRate ?? 0) : 0,
          },
        );

        const result = await createRoomOnChain(factoryAddress, preCreate, {
          name: args.name ?? '',
          symbol: args.symbol ?? '',
          description: args.description ?? '',
          logoUrl: args.logoUrl ?? '',
          website: args.website,
          twitter: args.twitter,
          telegram: args.telegram,
          tags: args.tags,
          taxEnabled: args.taxEnabled ?? false,
          taxRate: args.taxRate ?? 0,
          taxDistribution: args.taxDistribution
            ? {
                marketing: args.taxDistribution.marketing ?? 0,
                burn: args.taxDistribution.burn ?? 0,
                dividend: args.taxDistribution.dividend ?? 0,
                liquidity: args.taxDistribution.liquidity ?? 10,
              }
            : undefined,
          marketingWallet: args.marketingWallet,
          dividendMinHolding: args.dividendMinHolding,
        });

        return toolResult(
          JSON.stringify(
            {txHash: result.txHash, address: result.address, message: 'Room created successfully'},
            null,
            2,
          ),
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Create room failed: ${msg}`, true);
      }
    }) as never,
  );
}

const buyKeysSchema = z.object({
  roomAddress: z.string().describe('InternalLaunchpad (room) contract address'),
  team: z.number().min(0).max(3).describe('Team index: 0=Claw(龙虾队), 1=Whale, 2=Bull, 3=Bear'),
  amountBNB: z.string().describe('Amount of BNB to spend'),
  referrer: z.string().optional().describe('Referrer address (0x0 for none)'),
});

export function registerBuyKeys(server: McpServer): void {
  server.registerTool(
    'buy_keys',
    {
      description: 'Buy keys in an InternalLaunchpad room. team: 0=Claw(龙虾队), 1=Whale, 2=Bull, 3=Bear.',
      inputSchema: buyKeysSchema,
    },
    (async (args: {roomAddress?: string; team?: number; amountBNB?: string; referrer?: string}) => {
      try {
        const roomAddress = args.roomAddress ?? '';
        const team = (args.team ?? 0) as 0 | 1 | 2 | 3;
        const amountBNB = args.amountBNB ?? '0';
        const referrer = args.referrer ?? '0x0000000000000000000000000000000000000000';

        if (!roomAddress || amountBNB === '0') {
          return toolResult('roomAddress and amountBNB are required', true);
        }
        if (team < 0 || team > 3) {
          return toolResult('team must be 0-3 (Claw/龙虾队, Whale, Bull, Bear)', true);
        }

        const result = await buyKeys(roomAddress, team, amountBNB, referrer);
        return toolResult(JSON.stringify({txHash: result.txHash, message: 'Keys purchased successfully'}, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Buy keys failed: ${msg}`, true);
      }
    }) as never,
  );
}

const emptySchema = z.object({});

export function registerGetRooms(server: McpServer): void {
  server.registerTool(
    'get_rooms',
    {
      description: 'Get list of internal rooms (active launchpads).',
      inputSchema: emptySchema,
    },
    (async () => {
      try {
        const res = await apiClient.get<{serverTime: number; bnbUsd: number; rooms: unknown[]}>('/rooms', false);
        return toolResult(JSON.stringify(res, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Get rooms failed: ${msg}`, true);
      }
    }) as never,
  );
}

const roomSnapshotSchema = z.object({
  tokenAddress: z.string().describe('Token/room contract address'),
  userAddress: z.string().optional().describe('User address for user-specific stats'),
});

export function registerGetRoomSnapshot(server: McpServer): void {
  server.registerTool(
    'get_room_snapshot',
    {
      description: 'Get room snapshot by token address. Optionally include user stats.',
      inputSchema: roomSnapshotSchema,
    },
    (async ({tokenAddress, userAddress}: {tokenAddress?: string; userAddress?: string}) => {
      try {
        const path = userAddress
          ? `/rooms/${tokenAddress}/snapshot?user=${userAddress}`
          : `/rooms/${tokenAddress}/snapshot`;
        const res = await apiClient.get(path, false);
        return toolResult(JSON.stringify(res, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Get room snapshot failed: ${msg}`, true);
      }
    }) as never,
  );
}

const roomSnapshotByUuidSchema = z.object({
  uuid: z.string().describe('Token UUID'),
  userAddress: z.string().optional().describe('User address for user-specific stats'),
});

export function registerGetRoomSnapshotByUuid(server: McpServer): void {
  server.registerTool(
    'get_room_snapshot_by_uuid',
    {
      description: 'Get room snapshot by token UUID.',
      inputSchema: roomSnapshotByUuidSchema,
    },
    (async ({uuid, userAddress}: {uuid?: string; userAddress?: string}) => {
      try {
        const path = userAddress ? `/rooms/uuid/${uuid}/snapshot?user=${userAddress}` : `/rooms/uuid/${uuid}/snapshot`;
        const res = await apiClient.get(path, false);
        return toolResult(JSON.stringify(res, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolResult(`Get room snapshot failed: ${msg}`, true);
      }
    }) as never,
  );
}
