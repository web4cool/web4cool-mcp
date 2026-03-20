import {Wallet} from 'ethers';
import {getApiUrl} from './config.js';

const EXPIRY_BUFFER_SECONDS = 60;

interface JwtPayload {
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    return JSON.parse(payload) as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - EXPIRY_BUFFER_SECONDS <= now;
}

let cachedToken: string | null = null;

export async function login(wallet: Wallet): Promise<string> {
  const apiUrl = getApiUrl();
  const address = wallet.address;

  const nonceRes = await fetch(`${apiUrl}/auth/wallet/nonce?address=${address}`);
  if (!nonceRes.ok) {
    const text = await nonceRes.text();
    throw new Error(`Failed to get nonce: ${nonceRes.status} ${text}`);
  }

  const nonceBody = (await nonceRes.json()) as {data?: {nonce: string}; nonce?: string};
  const nonce = nonceBody.data?.nonce ?? nonceBody.nonce;
  if (!nonce) {
    throw new Error('No nonce in response');
  }
  const message = `Sign in to Platform\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
  const signature = await wallet.signMessage(message);

  const loginRes = await fetch(`${apiUrl}/auth/wallet/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Web4Cool-Client': 'mcp',
    },
    body: JSON.stringify({address, message, signature}),
  });

  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login failed: ${loginRes.status} ${text}`);
  }

  const loginBody = (await loginRes.json()) as {data?: {accessToken: string}; accessToken?: string};
  const token = loginBody.data?.accessToken ?? loginBody.accessToken;
  if (!token) {
    throw new Error('No accessToken in login response');
  }

  return token;
}

export async function getToken(wallet: Wallet): Promise<string> {
  if (cachedToken && !isTokenExpired(cachedToken)) {
    return cachedToken;
  }
  cachedToken = await login(wallet);
  return cachedToken;
}

export function clearToken(): void {
  cachedToken = null;
}
