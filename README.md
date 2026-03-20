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

- **Configuration wizard**: `web4cool-mcp --init` (short: `-i`), or `npm run init` from `packages/mcp-server` after a build. See [Configuration wizard](#configuration-wizard) below.

- **Help / version**: `web4cool-mcp --help` (`-h`), `web4cool-mcp --version` (`-v`).

## Configuration wizard

Run interactively in a normal terminal (not a non-TTY environment). The wizard:

1. Asks for a **wallet password** (8–128 characters, with lowercase, uppercase, number, and special character) and **private key**, then encrypts the key as `enc:…` for `.env` / MCP `env`.
2. Pre-fills **API URL** with `https://web4.cool/api/v1`, and **BSC testnet** defaults for RPC (`https://data-seed-prebsc-1-s1.binance.org:8545`), chain ID `97`, factory, and lens (same defaults as on web4.cool testnet)—you can change any of these.
3. Writes **`.env`** in the current directory.
4. On **macOS** or **Windows**, optionally merges the server entry into **Claude Desktop** `claude_desktop_config.json`. If you skip that or are on Linux, it writes **`config.json`** (`mcpServers` snippet) for you to add to Cursor or another client.

**Non-interactive / CI**: set `WEB4COOL_API_URL`, `WEB4COOL_PRIVATE_KEY`, and `WEB4COOL_WALLET_PASSWORD`, then run `npm run init` from `packages/mcp-server`. Missing optional RPC/chain/factory/lens values fall back to the same BSC testnet defaults as above; set `WEB4COOL_RPC_URL`, `WEB4COOL_CHAIN_ID`, `WEB4COOL_FACTORY_ADDRESS`, and `WEB4COOL_LENS_ADDRESS` beforehand to override. This path always writes `.env` and **`config.json`** (no Claude Desktop merge prompt).

Pure non-interactive **without** those three required env vars exits with instructions—use an external terminal or supply the env vars.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WEB4COOL_API_URL` | Yes | Backend base URL (no trailing slash required). Wizard default: `https://web4.cool/api/v1` |
| `WEB4COOL_PRIVATE_KEY` | Yes | Hex private key (`0x…`) or `enc:…` ciphertext from the wizard |
| `WEB4COOL_WALLET_PASSWORD` | If key is `enc:` | Password to decrypt the stored key |
| `WEB4COOL_RPC_URL` | No | BSC JSON-RPC; wizard defaults to public BSC testnet RPC when chain is testnet |
| `WEB4COOL_CHAIN_ID` | No | `97` (BSC testnet, wizard default) or `56` (mainnet) |
| `WEB4COOL_FACTORY_ADDRESS` | For create room / some dividend flows | Launchpad factory contract (wizard pre-fills testnet factory for web4.cool) |
| `WEB4COOL_LENS_ADDRESS` | For `get_keys_dividend_info` | Internal launchpad lens contract (wizard pre-fills testnet lens for web4.cool) |

## MCP client configuration

- **`config.example.json`** — template `mcpServers` snippet; set `args` to your built `dist/index.js` and `env` as above (example uses a local API URL; the wizard defaults to `https://web4.cool/api/v1`).
- After **`web4cool-mcp --init`**, use the generated **`config.json`** or the merged Claude Desktop config; `command` is `node` and `args` point at `dist/index.js` inside `packages/mcp-server`.

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
