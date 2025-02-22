import type { AssetList, Chain } from "@osmosis-labs/types";
import type { CacheEntry } from "cachified";
import type { LRUCache } from "lru-cache";
import { Address, Hex } from "viem";
import { z } from "zod";

export type BridgeEnvironment = "mainnet" | "testnet";

export interface BridgeProviderContext {
  env: BridgeEnvironment;
  cache: LRUCache<string, CacheEntry>;
  assetLists: AssetList[];
  chainList: Chain[];

  /** Provides current timeout height for a chain of the ID
   *  parsed from the bech32 config of the given destinationAddress. */
  getTimeoutHeight(params: { destinationAddress: string }): Promise<{
    revisionNumber: string | undefined;
    revisionHeight: string;
  }>;
}

export interface BridgeProvider {
  readonly providerName: string;

  /**
   * Requests a quote for a cross-chain transfer.
   *
   * @param params The parameters for the quote request.
   * @returns A promise that resolves to a GetBridgeQuoteResponse object.
   */
  getQuote(params: GetBridgeQuoteParams): Promise<BridgeQuote>;

  /**
   * Requests one or more transactions to initiate a cross-chain transfer.
   *
   * @param params The parameters from a prior quote request.
   * @returns A promise that resolves to a sign document ready to be signed.
   */
  getTransactionData: (
    params: GetBridgeQuoteParams
  ) => Promise<BridgeTransactionRequest>;

  /**
   * If the provider supports deposit address transfers:
   * Requests for a deposit address generated from the given params.
   * Sending to the deposit address automatically triggers the transfer.
   *
   * @param params The parameters from a prior quote request.
   * @returns A promise that resolves to a deposit address ready for signing.
   */
  getDepositAddress?: (
    params: GetDepositAddressParams
  ) => Promise<BridgeDepositAddress>;

  /**
   * Retrieves an external bridge URL for the given assets.
   *
   * This method generates a URL that can be used to perform a cross-chain transfer
   * using an external bridge service. The URL is constructed based on the provided
   * parameters, which include details about the source and destination chains, as well
   * as the assets involved in the transfer.
   *
   * @param params - The parameters required to generate the external bridge URL.
   * @param params.fromChain - The source chain from which the asset is being transferred.
   * @param params.toChain - The destination chain to which the asset is being transferred.
   * @param params.fromAsset - The asset being transferred from the source chain.
   * @param params.toAsset - The asset being received on the destination chain.
   * @param params.toAddress - The address on the destination chain to which the asset is being sent.
   *
   * @returns A promise that resolves to a BridgeExternalUrl object containing the URL and the provider name,
   *          or undefined if the URL could not be generated.
   */
  getExternalUrl: (
    params: GetBridgeExternalUrlParams
  ) => Promise<BridgeExternalUrl | undefined>;
}

const cosmosChainSchema = z.object({
  /**
   * Cosmos chainId
   *
   * Examples:
   * - osmosis-1
   * - cosmoshub-4
   */
  chainId: z.string(),
  /**
   * Optional: The human-readable name of the chain.
   */
  chainName: z.string().optional(),
  /**
   * Optional: The name of the network to which the chain belongs.
   */
  networkName: z.string().optional(),
  /**
   * The type of blockchain, which is 'cosmos' for Cosmos-based chains.
   */
  chainType: z.literal("cosmos"),
});

const evmChainSchema = z.object({
  /**
   * EVM chainId
   *
   * Examples:
   * - 1 (Ethereum)
   * - 10 (Optimism)
   */
  chainId: z.number(),
  /**
   * Optional: The human-readable name of the chain.
   */
  chainName: z.string().optional(),
  /**
   * Optional: The name of the network to which the chain belongs.
   */
  networkName: z.string().optional(),
  /**
   * The type of blockchain, which is 'evm' for EVM-based chains.
   */
  chainType: z.literal("evm"),
});

const bridgeChainSchema = z.union([cosmosChainSchema, evmChainSchema]);

export type BridgeChain = z.infer<typeof bridgeChainSchema>;

export interface BridgeStatus {
  /**
   * Indicates whether the bridge is currently in maintenance mode.
   */
  isInMaintenanceMode: boolean;
  /**
   * Optional: A message providing more information about the maintenance status.
   */
  maintenanceMessage?: string;
}

const bridgeAssetSchema = z.object({
  /**
   * The denomination of the asset.
   */
  denom: z.string(),
  /**
   * The address of the asset, represented as an IBC denom or EVM contract address.
   */
  address: z.string(),
  /**
   * The number of decimal places for the asset.
   */
  decimals: z.number(),

  /**
   * Global identifier for denom on origin chain.
   */
  sourceDenom: z.string(),
});

export type BridgeAsset = z.infer<typeof bridgeAssetSchema>;

export interface BridgeDepositAddress {
  depositAddress: string;
}

export interface GetDepositAddressParams {
  /**
   * The originating chain information.
   */
  fromChain: BridgeChain;
  /**
   * The destination chain information.
   */
  toChain: BridgeChain;
  /**
   * The asset on the originating chain.
   */
  fromAsset: BridgeAsset;
  /**
   * The address on the destination chain where the assets are to be received.
   */
  toAddress: string;
  autoUnwrapIntoNative?: boolean;
}

export const getBridgeExternalUrlSchema = z.object({
  /**
   * The originating chain information.
   */
  fromChain: bridgeChainSchema,
  /**
   * The destination chain information.
   */
  toChain: bridgeChainSchema,
  /**
   * The asset on the originating chain.
   */
  fromAsset: bridgeAssetSchema,
  /**
   * The asset on the destination chain.
   */
  toAsset: bridgeAssetSchema,
  /**
   * The address on the destination chain where the assets are to be received.
   */
  toAddress: z.string(),
});

export type GetBridgeExternalUrlParams = z.infer<
  typeof getBridgeExternalUrlSchema
>;

export const getBridgeQuoteSchema = z.object({
  /**
   * The originating chain information.
   */
  fromChain: bridgeChainSchema,
  /**
   * The destination chain information.
   */
  toChain: bridgeChainSchema,
  /**
   * The asset on the originating chain.
   */
  fromAsset: bridgeAssetSchema,
  /**
   * The asset on the destination chain.
   */
  toAsset: bridgeAssetSchema,
  /**
   * The amount to be transferred from the originating chain, represented as a string.
   */
  fromAmount: z.string(),
  /**
   * The address on the originating chain from where the assets are transferred.
   */
  fromAddress: z.string(),
  /**
   * The address on the destination chain where the assets are to be received.
   */
  toAddress: z.string(),
  /**
   * Optional: The tolerance for price slippage, represented as a percentage. Valid values are > 0 and < 99.99.
   */
  slippage: z.number().optional(),
});

export type GetBridgeQuoteParams = z.infer<typeof getBridgeQuoteSchema>;

export interface EvmBridgeTransactionRequest {
  type: "evm";
  to: Address;
  data?: Hex;
  value?: string;
  gasPrice?: string;
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  /** Also known as gas limit */
  gas?: string;
  /** Approval transaction for tokens when needed */
  approvalTransactionRequest?: {
    to: string;
    data: string;
  };
}

export interface CosmosBridgeTransactionRequest {
  type: "cosmos";
  msgTypeUrl: string;
  msg: Record<string, any>;
}

interface QRCodeBridgeTransactionRequest {
  type: "qrcode";
}

export type BridgeTransactionRequest =
  | EvmBridgeTransactionRequest
  | CosmosBridgeTransactionRequest
  | QRCodeBridgeTransactionRequest;

/**
 * Bridge asset with raw base amount (without decimals).
 */
export type BridgeCoin = {
  amount: string;
  denom: string;
  /** Global identifier for denom on origin chain. */
  sourceDenom: string;
  decimals: number;
};

export interface BridgeQuote {
  input: Required<BridgeCoin>;
  expectedOutput: Required<BridgeCoin> & {
    /** Percentage represented as string. E.g. 10.0, 95.0 */
    priceImpact: string;
  };
  fromChain: Pick<BridgeChain, "chainId" | "chainName" | "chainType">;
  toChain: Pick<BridgeChain, "chainId" | "chainName" | "chainType">;
  /**
   * The fee for the transfer.
   */
  transferFee: BridgeCoin;
  /**
   * The estimated time to execute the transfer, represented in seconds.
   */
  estimatedTime: number;
  /**
   * The estimated gas fee for the transfer.
   */
  estimatedGasFee?: BridgeCoin;

  /** Sign doc. */
  transactionRequest?: BridgeTransactionRequest;
}

export interface BridgeExternalUrl {
  urlProviderName: string;
  url: URL;
}

// Transfer status

export interface GetTransferStatusParams {
  sendTxHash: string;
  fromChainId: BridgeChain["chainId"];
  toChainId: BridgeChain["chainId"];
}

export interface BridgeTransferStatus {
  id: string;
  status: TransferStatus;
  reason?: TransferFailureReason;
}

/** Capable of receiving updates as a delegate passed to a `TransferStatusProvider`. */
export interface TransferStatusReceiver {
  /** Key with prefix (`keyPrefix`) included. */
  receiveNewTxStatus(
    prefixedKey: string,
    status: TransferStatus,
    displayReason?: string
  ): void;
}

/** A simplified transfer status. */
export type TransferStatus =
  | "success"
  | "pending"
  | "failed"
  | "refunded"
  | "connection-error";

/** A simplified reason for transfer failure. */
export type TransferFailureReason = "insufficientFee";

/** Plugin to fetch status of many transactions from a remote source. */
export interface TransferStatusProvider {
  /** Example: axelar */
  readonly keyPrefix: string;
  readonly sourceDisplayName?: string;
  /** Destination for updates to tracked transactions.  */
  statusReceiverDelegate?: TransferStatusReceiver;

  /**
   * Source instance should begin tracking a transaction identified by `key`.
   * @param key Example: Tx hash without prefix i.e. `0x...`
   */
  trackTxStatus(key: string): void;

  /** Make url to this tx explorer. */
  makeExplorerUrl(key: string): string;
}
