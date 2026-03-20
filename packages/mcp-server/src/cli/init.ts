import prompts from 'prompts';
import type {PromptObject} from 'prompts';
import figlet from 'figlet';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'fs-extra';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {Wallet} from 'ethers';
import {encryptPrivateKey} from '../PrivateAES.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const onCancel = () => {
  console.log(chalk.red('\nConfiguration cancelled. Exiting...'));
  process.exit(0);
};

function validatePassword(pwd: string): boolean | string {
  if (pwd.trim() === '') return 'Password is required';
  if (pwd.length < 8 || pwd.length > 128) return 'Password must be 8-128 characters';
  if (!/[a-z]/.test(pwd)) return 'Password must contain lowercase';
  if (!/[A-Z]/.test(pwd)) return 'Password must contain uppercase';
  if (!/[0-9]/.test(pwd)) return 'Password must contain number';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) return 'Password must contain special character';
  return true;
}

function getClaudeConfigPath(): string | null {
  const home = os.homedir();
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(home, 'Library/Application Support/Claude/claude_desktop_config.json');
  }
  if (platform === 'win32') {
    return path.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  }
  return null;
}

export async function init(): Promise<void> {
  console.log(chalk.cyan(figlet.textSync('Web4cool MCP', {font: 'Big'})));
  console.log(chalk.cyan('Configuration wizard\n'));

  const fromEnv =
    process.env.WEB4COOL_API_URL && process.env.WEB4COOL_PRIVATE_KEY && process.env.WEB4COOL_WALLET_PASSWORD;

  if (fromEnv) {
    console.log(chalk.yellow('Using env vars for API/KEY/PASSWORD. Checking optional chain config...\n'));
    const apiUrl = process.env.WEB4COOL_API_URL!;
    const privateKey = process.env.WEB4COOL_PRIVATE_KEY!;
    const walletPassword = process.env.WEB4COOL_WALLET_PASSWORD!;

    let rpcUrl = process.env.WEB4COOL_RPC_URL?.trim();
    let chainId = process.env.WEB4COOL_CHAIN_ID?.trim();
    let factoryAddress = process.env.WEB4COOL_FACTORY_ADDRESS?.trim();
    let lensAddress = process.env.WEB4COOL_LENS_ADDRESS?.trim();

    const DEFAULT_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';
    const DEFAULT_CHAIN_ID = '97';
    const missingOptional = !rpcUrl || !chainId;

    if (missingOptional && process.stdin.isTTY) {
      console.log(
        chalk.cyan(
          'Optional: RPC, Chain ID, Factory, Lens (for create_room/buy_keys/dividend tools). Press Enter to use defaults.\n',
        ),
      );
      const extra = await prompts(
        [
          {type: 'text', name: 'rpcUrl', message: 'RPC URL:', initial: rpcUrl || DEFAULT_RPC},
          {
            type: 'text',
            name: 'chainId',
            message: 'Chain ID (56=mainnet, 97=testnet):',
            initial: chainId || DEFAULT_CHAIN_ID,
          },
          {
            type: 'text',
            name: 'factoryAddress',
            message: 'Factory address (for create_room, optional):',
            initial: factoryAddress || '',
          },
          {
            type: 'text',
            name: 'lensAddress',
            message: 'Lens address (for get_keys_dividend_info, optional):',
            initial: lensAddress || '',
          },
        ],
        {onCancel},
      );
      rpcUrl = String(extra.rpcUrl ?? '').trim() || rpcUrl || DEFAULT_RPC;
      chainId = String(extra.chainId ?? '').trim() || chainId || DEFAULT_CHAIN_ID;
      factoryAddress = String(extra.factoryAddress ?? '').trim() || factoryAddress;
      lensAddress = String(extra.lensAddress ?? '').trim() || lensAddress;
    } else if (missingOptional) {
      rpcUrl = rpcUrl || DEFAULT_RPC;
      chainId = chainId || DEFAULT_CHAIN_ID;
      lensAddress = lensAddress || process.env.WEB4COOL_LENS_ADDRESS?.trim();
      console.log(
        chalk.yellow(
          'Non-interactive: using defaults (RPC=testnet, chainId=97).\n' +
            '  To customize, add before npm run init:\n' +
            '  WEB4COOL_RPC_URL=... WEB4COOL_CHAIN_ID=97 WEB4COOL_FACTORY_ADDRESS=0x... WEB4COOL_LENS_ADDRESS=0x...\n',
        ),
      );
    }

    const encValue = privateKey.startsWith('enc:')
      ? privateKey.slice(4)
      : await encryptPrivateKey(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`, walletPassword);

    const envLines = [
      `WEB4COOL_API_URL=${apiUrl}`,
      `WEB4COOL_PRIVATE_KEY=enc:${encValue}`,
      `WEB4COOL_WALLET_PASSWORD=${walletPassword}`,
    ];
    if (rpcUrl) envLines.push(`WEB4COOL_RPC_URL=${rpcUrl}`);
    if (chainId) envLines.push(`WEB4COOL_CHAIN_ID=${chainId}`);
    if (factoryAddress) envLines.push(`WEB4COOL_FACTORY_ADDRESS=${factoryAddress}`);
    if (lensAddress) envLines.push(`WEB4COOL_LENS_ADDRESS=${lensAddress}`);
    await fs.writeFile('.env', envLines.join('\n') + '\n');
    console.log(chalk.green('✅ .env created'));

    const indexPath = path.resolve(__dirname, '..', 'index.js');
    const env: Record<string, string> = {
      WEB4COOL_API_URL: apiUrl,
      WEB4COOL_PRIVATE_KEY: `enc:${encValue}`,
      WEB4COOL_WALLET_PASSWORD: walletPassword,
    };
    if (rpcUrl) env.WEB4COOL_RPC_URL = rpcUrl;
    if (chainId) env.WEB4COOL_CHAIN_ID = chainId;
    if (factoryAddress) env.WEB4COOL_FACTORY_ADDRESS = factoryAddress;
    if (lensAddress) env.WEB4COOL_LENS_ADDRESS = lensAddress;

    const config = {
      web4cool: {
        command: 'node',
        args: [indexPath],
        env,
      },
    };
    await fs.writeJson('config.json', {mcpServers: config}, {spaces: 2});
    console.log(chalk.green('✅ config.json saved. Add to Cursor MCP settings.'));
    return;
  }

  if (!process.stdin.isTTY) {
    console.log(
      chalk.yellow(
        'Terminal is non-interactive. Run with env vars instead:\n' +
          '  WEB4COOL_API_URL=http://localhost:4000/api/v1 \\\n' +
          '  WEB4COOL_PRIVATE_KEY=0xYOUR_KEY \\\n' +
          '  WEB4COOL_WALLET_PASSWORD=your_password \\\n' +
          '  [WEB4COOL_RPC_URL=...] [WEB4COOL_CHAIN_ID=97] [WEB4COOL_FACTORY_ADDRESS=0x...] [WEB4COOL_LENS_ADDRESS=0x...] \\\n' +
          '  npm run init\n\n' +
          'Or run this command in an external terminal (outside Cursor).',
      ),
    );
    process.exit(1);
  }

  const questions: PromptObject[] = [
    {
      type: 'password',
      name: 'walletPassword',
      message: 'Wallet password (8-128 chars, with upper/lower/number/special):',
      validate: (val: unknown) => validatePassword(String(val ?? '')),
    },
    {
      type: 'password',
      name: 'privateKey',
      message: 'Wallet private key:',
      validate: (val: unknown) => (String(val ?? '').trim() === '' ? 'Private key is required' : true),
    },
    {
      type: 'text',
      name: 'apiUrl',
      message: 'API URL (e.g. http://localhost:4000/api/v1):',
      initial: 'http://localhost:4000/api/v1',
    },
    {
      type: 'text',
      name: 'rpcUrl',
      message: 'RPC URL (optional, for create_room/buy_keys):',
      initial: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    },
    {
      type: 'text',
      name: 'chainId',
      message: 'Chain ID (optional: 56=BSC mainnet, 97=testnet):',
      initial: '97',
    },
    {
      type: 'text',
      name: 'factoryAddress',
      message: 'Factory address (optional, for create_room):',
      initial: '',
    },
    {
      type: 'text',
      name: 'lensAddress',
      message: 'Lens address (optional, for get_keys_dividend_info):',
      initial: '',
    },
  ];

  const {walletPassword, privateKey, apiUrl, rpcUrl, chainId, factoryAddress, lensAddress} = (await prompts(questions, {
    onCancel,
  })) as {
    walletPassword: string;
    privateKey: string;
    apiUrl: string;
    rpcUrl: string;
    chainId: string;
    factoryAddress: string;
    lensAddress: string;
  };

  const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const encrypted = await encryptPrivateKey(pk, walletPassword);

  const envLines = [
    `WEB4COOL_API_URL=${apiUrl}`,
    `WEB4COOL_PRIVATE_KEY=enc:${encrypted}`,
    `WEB4COOL_WALLET_PASSWORD=${walletPassword}`,
  ];
  if (rpcUrl?.trim()) envLines.push(`WEB4COOL_RPC_URL=${rpcUrl.trim()}`);
  if (chainId?.trim()) envLines.push(`WEB4COOL_CHAIN_ID=${chainId.trim()}`);
  if (factoryAddress?.trim()) envLines.push(`WEB4COOL_FACTORY_ADDRESS=${factoryAddress.trim()}`);
  if (lensAddress?.trim()) envLines.push(`WEB4COOL_LENS_ADDRESS=${lensAddress.trim()}`);
  await fs.writeFile('.env', envLines.join('\n') + '\n');
  console.log(chalk.green('✅ .env created'));

  const indexPath = path.resolve(__dirname, '..', 'index.js');
  const env: Record<string, string> = {
    WEB4COOL_API_URL: apiUrl,
    WEB4COOL_PRIVATE_KEY: `enc:${encrypted}`,
    WEB4COOL_WALLET_PASSWORD: walletPassword,
  };
  if (rpcUrl?.trim()) env.WEB4COOL_RPC_URL = rpcUrl.trim();
  if (chainId?.trim()) env.WEB4COOL_CHAIN_ID = chainId.trim();
  if (factoryAddress?.trim()) env.WEB4COOL_FACTORY_ADDRESS = factoryAddress.trim();
  if (lensAddress?.trim()) env.WEB4COOL_LENS_ADDRESS = lensAddress.trim();

  const config = {
    web4cool: {
      command: 'node',
      args: [indexPath],
      env,
    },
  };

  const claudePath = getClaudeConfigPath();
  const {setupClaude} = await prompts(
    {
      type: 'confirm',
      name: 'setupClaude',
      message: 'Configure Claude Desktop?',
      initial: true,
    },
    {onCancel},
  );

  if (setupClaude && claudePath) {
    let data: {mcpServers?: Record<string, unknown>} = {};
    if (await fs.pathExists(claudePath)) {
      data = await fs.readJson(claudePath);
    }
    data.mcpServers = {...data.mcpServers, ...config};
    await fs.writeJson(claudePath, data, {spaces: 2});
    console.log(chalk.green('✅ Claude Desktop configured. Restart Claude.'));
  } else {
    await fs.writeJson('config.json', {mcpServers: config}, {spaces: 2});
    console.log(chalk.yellow('📁 config.json saved. Add to Cursor/Claude manually.'));
  }
}
