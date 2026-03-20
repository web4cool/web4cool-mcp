import {Wallet} from 'ethers';
import {decryptPrivateKey} from './PrivateAES.js';

const ENC_PREFIX = 'enc:';

const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';
const BSC_MAINNET_RPC = 'https://bsc-dataseed.binance.org';

const BSC_MAINNET = {
  router: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as `0x${string}`,
  wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as `0x${string}`,
};
const BSC_TESTNET = {
  router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1' as `0x${string}`,
  wbnb: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' as `0x${string}`,
};

export function getApiUrl(): string {
  const url = process.env.WEB4COOL_API_URL;
  if (!url) {
    throw new Error('WEB4COOL_API_URL is required');
  }
  return url.replace(/\/$/, '');
}

export async function getPrivateKey(): Promise<string> {
  const raw = process.env.WEB4COOL_PRIVATE_KEY;
  if (!raw) {
    throw new Error('WEB4COOL_PRIVATE_KEY is required');
  }

  if (raw.startsWith(ENC_PREFIX)) {
    const encrypted = raw.slice(ENC_PREFIX.length);
    const password = process.env.WEB4COOL_WALLET_PASSWORD;
    if (!password) {
      throw new Error('WEB4COOL_WALLET_PASSWORD is required when using encrypted private key');
    }
    const decrypted = await decryptPrivateKey(encrypted, password);
    if (!decrypted) {
      throw new Error('Failed to decrypt private key - wrong password?');
    }
    return decrypted;
  }

  return raw.startsWith('0x') ? raw : `0x${raw}`;
}

export async function getWallet(): Promise<Wallet> {
  const pk = await getPrivateKey();
  return new Wallet(pk);
}

export function getRpcUrl(): string {
  const url = process.env.WEB4COOL_RPC_URL;
  if (url) return url;
  return getChainId() === 97 ? BSC_TESTNET_RPC : BSC_MAINNET_RPC;
}

export function getChainId(): 56 | 97 {
  const raw = String(process.env.WEB4COOL_CHAIN_ID ?? '97').trim();
  return raw === '56' ? 56 : 97;
}

export function getFactoryAddress(): string | undefined {
  return process.env.WEB4COOL_FACTORY_ADDRESS as string | undefined;
}

export function getLensAddress(): string | undefined {
  return process.env.WEB4COOL_LENS_ADDRESS as string | undefined;
}

export function getChainConfig(): {router: `0x${string}`; wbnb: `0x${string}`} {
  return getChainId() === 97 ? BSC_TESTNET : BSC_MAINNET;
}
