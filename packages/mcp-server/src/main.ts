import 'dotenv/config';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  registerCreateRoom,
  registerBuyKeys,
  registerGetRooms,
  registerGetRoomSnapshot,
  registerGetRoomSnapshotByUuid,
} from './tools/room.tools.js';
import {registerGetMyTokens, registerGetToken, registerGetHolders} from './tools/token.tools.js';
import {registerGetWalletNonce, registerWalletLogin, registerMcpReLogin} from './tools/auth.tools.js';
import {registerDividendTools} from './tools/dividend.tools.js';

export async function main(): Promise<void> {
  const server = new McpServer({
    name: 'web4cool',
    version: '0.1.0',
  });

  registerGetWalletNonce(server);
  registerWalletLogin(server);
  registerMcpReLogin(server);
  registerCreateRoom(server);
  registerBuyKeys(server);
  registerGetRooms(server);
  registerGetRoomSnapshot(server);
  registerGetRoomSnapshotByUuid(server);
  registerGetMyTokens(server);
  registerGetToken(server);
  registerGetHolders(server);
  registerDividendTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
