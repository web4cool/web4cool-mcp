# web4cool-mcp

[Model Context Protocol](https://modelcontextprotocol.io/) server for **Web4cool**: internal launchpad rooms, wallet auth against the backend API, on-chain actions on BSC (testnet or mainnet), and dividend / claim helpers.

Code lives in `packages/mcp-server` (`@web4cool/mcp-server`).

## Requirements

- Node.js **≥ 20**

## Build and run

```bash
cd packages/mcp-server
npm install
npm run build
```

- **Start MCP (stdio)** — what clients such as Cursor or Claude Desktop invoke:

  ```bash
  npm start
  ```

  Or use the CLI name after install/link: `web4cool-mcp`.

- **Configuration wizard** (optional): `web4cool-mcp --init` (`-i`) — interactive setup; can merge into Claude Desktop config on macOS/Windows when applicable.

- **Help / version**: `web4cool-mcp --help`, `web4cool-mcp --version`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WEB4COOL_API_URL` | Yes | Backend base URL (no trailing slash required), e.g. `http://localhost:4000/api/v1` |
| `WEB4COOL_PRIVATE_KEY` | Yes | Hex private key (`0x…`) or `enc:…` ciphertext from the init wizard |
| `WEB4COOL_WALLET_PASSWORD` | If key is `enc:` | Password to decrypt the stored key |
| `WEB4COOL_RPC_URL` | No | BSC JSON-RPC; defaults to public testnet or mainnet RPC from `WEB4COOL_CHAIN_ID` |
| `WEB4COOL_CHAIN_ID` | No | `97` (BSC testnet, default) or `56` (mainnet) |
| `WEB4COOL_FACTORY_ADDRESS` | For create room / some dividend flows | Launchpad factory contract |
| `WEB4COOL_LENS_ADDRESS` | For `get_keys_dividend_info` | Internal launchpad lens contract |

## MCP client configuration

See `packages/mcp-server/config.example.json` for a `mcpServers` snippet. Point `args` at your built `dist/index.js` and set `env` as above.

## Tools (summary)

**Auth**

- `get_wallet_nonce` — nonce for wallet login
- `wallet_login` — sign message and exchange for session (response redacts token in logs)
- `mcp_re_login` — clear cache and re-login with the MCP wallet

**Rooms & keys**

- `create_room` — backend pre-create + on-chain `createLaunchpadDeterministic` (needs factory address)
- `buy_keys` — buy keys in a room (team index 0–3)
- `get_rooms` — list active internal rooms
- `get_room_snapshot` / `get_room_snapshot_by_uuid` — room snapshot by address or UUID

**Tokens**

- `get_my_tokens` — holdings for logged-in wallet
- `get_token` — token metadata by address
- `get_holders` — key holders for a room

**Dividends & claims**

- `get_keys_dividend_info` — per-room keys dividend info (needs lens)
- `claim_keys_dividend`
- `get_platform_dividend_info` / `claim_platform_dividend` — platform token dividends (needs factory)
- `get_claimable_tokens` / `claim_external_tokens` — graduated-room external token claims

Treat `WEB4COOL_PRIVATE_KEY` like production secrets: prefer `enc:` + `WEB4COOL_WALLET_PASSWORD`, and restrict who can read your MCP config.
