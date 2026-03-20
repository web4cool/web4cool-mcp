import {JsonRpcProvider, Contract, Wallet, parseEther} from 'ethers';
import {getRpcUrl, getFactoryAddress, getChainConfig, getWallet, getLensAddress} from './config.js';
import LaunchpadFactoryAbi from './abis/LaunchpadFactory.json' with {type: 'json'};
import InternalLaunchpad from './abis/InternalLaunchpad.json' with {type: 'json'};
import InternalLaunchpadLens from './abis/InternalLaunchpadLens.json' with {type: 'json'};
import Web4coolToken from './abis/Web4coolToken.json' with {type: 'json'};

const DEFAULT_MAX_SUPPLY = BigInt(1_000_000_000) * BigInt(10 ** 18);
const DEFAULT_ROUND_COUNT = BigInt(1);
const TAX_RATE_BASE = 100;
const SHARE_BASE = 10;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export type CreateRoomParams = {
  name: string;
  symbol: string;
  description: string;
  logoUrl: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  tags?: string[];
  taxEnabled?: boolean;
  taxRate?: number;
  taxDistribution?: {marketing: number; burn: number; dividend: number; liquidity: number};
  marketingWallet?: string;
  dividendMinHolding?: string;
};

export type PreCreateResult = {
  address: string;
  salt: string;
  signature: string;
};

export type BuyKeyTeam = 0 | 1 | 2 | 3; // Claw(龙虾队)=0, Whale=1, Bull=2, Bear=3

let cachedProvider: JsonRpcProvider | null = null;

export function getProvider(): JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new JsonRpcProvider(getRpcUrl());
  }
  return cachedProvider;
}

export async function readFactoryData(factoryAddress: string): Promise<{
  creationFee: bigint;
  dividendTrackerImpl: `0x${string}`;
}> {
  const provider = getProvider();
  const factory = new Contract(factoryAddress, LaunchpadFactoryAbi as never, provider);
  const [creationFee, dividendTrackerImpl] = await Promise.all([factory.creationFee(), factory.dividendTrackerImpl()]);
  return {creationFee, dividendTrackerImpl: dividendTrackerImpl as `0x${string}`};
}

export async function createRoomOnChain(
  factoryAddress: string,
  preCreate: PreCreateResult,
  params: CreateRoomParams,
): Promise<{txHash: string; address: string}> {
  const wallet = await getWallet();
  const provider = getProvider();
  const signer = wallet.connect(provider);

  const {creationFee, dividendTrackerImpl} = await readFactoryData(factoryAddress);
  const {router, wbnb} = getChainConfig();

  const taxDist = params.taxDistribution ?? {marketing: 0, burn: 0, dividend: 0, liquidity: 10};
  const taxEnabled = params.taxEnabled ?? false;
  const taxRate = params.taxRate ?? 0;
  const marketingWallet = params.marketingWallet ?? ZERO_ADDRESS;
  const dividendMinHolding = params.dividendMinHolding ?? '0';

  const initParams = {
    name: params.name,
    symbol: params.symbol,
    router,
    wbnb,
    rewardToken: wbnb,
    dividendTrackerImpl,
    maxSupply: DEFAULT_MAX_SUPPLY,
    roundCount: DEFAULT_ROUND_COUNT,
  };

  const minimumTokenBalanceForDividends =
    taxDist.dividend > 0 ? BigInt(parseFloat(dividendMinHolding) * 1e18) : BigInt(0);

  const taxParams = {
    taxEnabled,
    createDividendTracker: false,
    taxRate: BigInt(Math.round(taxRate * TAX_RATE_BASE)),
    marketingShare: BigInt(Math.round(taxDist.marketing * SHARE_BASE)),
    burnShare: BigInt(Math.round(taxDist.burn * SHARE_BASE)),
    rewardShare: BigInt(Math.round(taxDist.dividend * SHARE_BASE)),
    liquidityShare: BigInt(Math.round(taxDist.liquidity * SHARE_BASE)),
    marketingWallet: (taxEnabled && taxDist.marketing > 0 ? marketingWallet : ZERO_ADDRESS) as `0x${string}`,
    minimumTokenBalanceForDividends,
  };

  const factory = new Contract(factoryAddress, LaunchpadFactoryAbi as never, signer);
  const tx = await factory.createLaunchpadDeterministic(preCreate.salt, preCreate.signature, initParams, taxParams, {
    value: creationFee,
  });
  const receipt = await tx.wait();
  return {txHash: receipt.hash, address: preCreate.address};
}

export async function buyKeys(
  roomAddress: string,
  team: BuyKeyTeam,
  amountBNB: string,
  referrer = ZERO_ADDRESS,
): Promise<{txHash: string}> {
  const wallet = await getWallet();
  const provider = getProvider();
  const signer = wallet.connect(provider);

  const contract = new Contract(roomAddress, InternalLaunchpad as never, signer);
  const valueWei = parseEther(amountBNB);
  const tx = await contract.buyKeys(team, referrer, {value: valueWei});
  const receipt = await tx.wait();
  return {txHash: receipt.hash};
}

export type BalanceInfo = {
  token: string;
  name: string;
  symbol: string;
  balance: bigint;
  roundId: bigint;
  isExternalMarket: boolean;
  dividendsBNBAccrued: bigint;
  totalDividendsBNB: bigint;
  nextClaimTime: bigint;
};

export async function getKeysDividendInfo(userAddress: string, roomAddresses: string[]): Promise<BalanceInfo[]> {
  const lensAddress = getLensAddress();
  if (!lensAddress) {
    throw new Error('WEB4COOL_LENS_ADDRESS not configured');
  }
  const provider = getProvider();
  const lens = new Contract(lensAddress, InternalLaunchpadLens as never, provider);
  const result = await lens.batchGetBalances(userAddress, roomAddresses);
  return (result as unknown[]).map((r: unknown) => {
    const item = r as Record<string, unknown>;
    return {
      token: String(item.token ?? ''),
      name: String(item.name ?? ''),
      symbol: String(item.symbol ?? ''),
      balance: BigInt(item.balance?.toString() ?? '0'),
      roundId: BigInt(item.roundId?.toString() ?? '0'),
      isExternalMarket: Boolean(item.isExternalMarket),
      dividendsBNBAccrued: BigInt(item.dividendsBNBAccrued?.toString() ?? '0'),
      totalDividendsBNB: BigInt(item.totalDividendsBNB?.toString() ?? '0'),
      nextClaimTime: BigInt(item.nextClaimTime?.toString() ?? '0'),
    };
  });
}

export type PlatformDividendInfo = {
  withdrawableDividends: bigint;
  nextClaimTime: bigint;
  raw: unknown[];
};

export async function getPlatformDividendInfo(
  platformTokenAddress: string,
  userAddress: string,
): Promise<PlatformDividendInfo> {
  const provider = getProvider();
  const token = new Contract(platformTokenAddress, Web4coolToken as never, provider);
  const result = await token.getAccountDividendsInfo(userAddress);
  const arr = Array.isArray(result) ? result : [result];
  return {
    withdrawableDividends: BigInt(arr[1]?.toString() ?? '0'),
    nextClaimTime: BigInt(arr[6]?.toString() ?? arr[7]?.toString() ?? '0'),
    raw: arr,
  };
}

export async function getClaimableTokens(roomAddress: string, userAddress: string): Promise<bigint> {
  const provider = getProvider();
  const contract = new Contract(roomAddress, InternalLaunchpad as never, provider);
  const result = await contract.getClaimableTokens(userAddress);
  return BigInt(result.toString());
}

export async function getPlatformTokenAddress(): Promise<string> {
  const factoryAddress = getFactoryAddress();
  if (!factoryAddress) {
    throw new Error('WEB4COOL_FACTORY_ADDRESS not configured');
  }
  const provider = getProvider();
  const factory = new Contract(factoryAddress, LaunchpadFactoryAbi as never, provider);
  const addr = await factory.platformToken();
  return addr as string;
}

export async function claimKeysDividend(roomAddress: string): Promise<{txHash: string}> {
  const factoryAddress = getFactoryAddress();
  if (!factoryAddress) {
    throw new Error('WEB4COOL_FACTORY_ADDRESS not configured');
  }
  const wallet = await getWallet();
  const provider = getProvider();
  const signer = wallet.connect(provider);
  const factory = new Contract(factoryAddress, LaunchpadFactoryAbi as never, signer);
  const tx = await factory.claimKeyDividends(roomAddress);
  const receipt = await tx.wait();
  return {txHash: receipt.hash};
}

export async function claimPlatformDividend(platformTokenAddress: string): Promise<{txHash: string}> {
  const wallet = await getWallet();
  const provider = getProvider();
  const signer = wallet.connect(provider);
  const token = new Contract(platformTokenAddress, Web4coolToken as never, signer);
  const tx = await token.claim();
  const receipt = await tx.wait();
  return {txHash: receipt.hash};
}

export async function claimExternalTokens(roomAddress: string): Promise<{txHash: string}> {
  const wallet = await getWallet();
  const provider = getProvider();
  const signer = wallet.connect(provider);
  const contract = new Contract(roomAddress, InternalLaunchpad as never, signer);
  const tx = await contract.claimTokens();
  const receipt = await tx.wait();
  return {txHash: receipt.hash};
}
