export function printHelp(): void {
  console.log(`
Web4cool MCP Server - Room creation, status queries, and token management

Usage:
  web4cool-mcp              Start MCP server (stdio)
  web4cool-mcp --init       Run configuration wizard
  web4cool-mcp --help       Show this help
  web4cool-mcp --version    Show version

Environment variables:
  WEB4COOL_API_URL          Backend API URL (e.g. http://localhost:4000/api/v1)
  WEB4COOL_PRIVATE_KEY      Wallet private key (0x prefix, or enc:base64 for encrypted)
  WEB4COOL_WALLET_PASSWORD  Password for encrypted private key (when using enc: prefix)

Cursor/Claude config example:
  {
    "mcpServers": {
      "web4cool": {
        "command": "node",
        "args": ["/path/to/mcp-server/dist/index.js"],
        "env": {
          "WEB4COOL_API_URL": "http://localhost:4000/api/v1",
          "WEB4COOL_PRIVATE_KEY": "0x..."
        }
      }
    }
  }
`);
}
