import type { WalletSelector } from "@near-wallet-selector/core";

import "@near-wallet-selector/modal-ui/styles.css";

export type NearNetwork = "testnet" | "mainnet";

const network = (import.meta.env.VITE_NEAR_NETWORK ?? "testnet") as NearNetwork;
const contractId = (import.meta.env.VITE_NEAR_CONTRACT_ID ?? "").trim();
const milestoneId = (import.meta.env.VITE_NEAR_MILESTONE_ID ?? "kanso-001").trim();

const rpcUrl =
  network === "mainnet" ? "https://rpc.mainnet.near.org" : "https://rpc.testnet.near.org";
const explorerUrl = network === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io";

let providerPromise: Promise<import("near-api-js").JsonRpcProvider> | undefined;
let selectorPromise: Promise<WalletSelector> | undefined;
let modalPromise: { show: () => void } | undefined;

export const nearRuntime = {
  network,
  contractId,
  milestoneId,
  rpcUrl,
  explorerUrl,
};

export function isNearConfigured(): boolean {
  return contractId.length > 0;
}

export function getExplorerTransactionUrl(transactionHash: string): string {
  return `${explorerUrl}/txns/${encodeURIComponent(transactionHash)}`;
}

export function getExplorerAccountUrl(accountId: string): string {
  return `${explorerUrl}/address/${encodeURIComponent(accountId)}`;
}

export function formatNearError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "The wallet or NEAR RPC request failed. Refresh and try again from current chain state.";
}

export function parseNearToYocto(value: string): string {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("NEAR amount must be a positive decimal number.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > 24) {
    throw new Error("NEAR amounts support at most 24 decimal places.");
  }
  const yocto = `${whole}${fraction.padEnd(24, "0")}`.replace(/^0+(?=\d)/, "");
  if (BigInt(yocto) <= 0n) throw new Error("NEAR amount must be greater than zero.");
  return yocto;
}

async function getSelector(): Promise<WalletSelector> {
  if (!isNearConfigured()) {
    throw new Error("Set VITE_NEAR_CONTRACT_ID to enable testnet mode.");
  }

  selectorPromise ??= Promise.all([
    import("@near-wallet-selector/core"),
    import("@near-wallet-selector/my-near-wallet"),
  ]).then(([core, myNearWallet]) =>
    core.setupWalletSelector({
      network,
      modules: [myNearWallet.setupMyNearWallet()],
      createAccessKeyFor: {
        contractId,
        methodNames: ["submit_delivery", "approve_delivery", "release", "refund_expired", "creator_cancel"],
      },
    }),
  );

  return selectorPromise;
}

export async function showNearWalletModal(): Promise<void> {
  const selector = await getSelector();
  const { setupModal } = await import("@near-wallet-selector/modal-ui");
  modalPromise ??= setupModal(selector, {
    contractId,
    methodNames: ["submit_delivery", "approve_delivery", "release", "refund_expired", "creator_cancel"],
    theme: "light",
    description: "Sign only the BriefLock action you can authorize.",
  });
  modalPromise.show();
}

export async function getNearAccounts(): Promise<string[]> {
  if (!isNearConfigured()) return [];
  const selector = await getSelector();
  return selector.store.getState().accounts.map((account) => account.accountId);
}

export async function subscribeToNearAccounts(
  onAccounts: (accounts: string[]) => void,
): Promise<() => void> {
  if (!isNearConfigured()) return () => undefined;
  const selector = await getSelector();
  const subscription = selector.store.observable.subscribe((state) => {
    onAccounts(state.accounts.map((account) => account.accountId));
  });
  onAccounts(selector.store.getState().accounts.map((account) => account.accountId));
  return () => subscription.unsubscribe();
}

export async function signNearContractCall(
  methodName: string,
  args: Record<string, unknown>,
  depositYocto = "0",
): Promise<unknown> {
  const selector = await getSelector();
  const { actionCreators } = await import("@near-wallet-selector/core");
  const accountId = selector.store.getState().accounts[0]?.accountId;
  if (!accountId) throw new Error("Connect a testnet wallet before signing.");

  const wallet = await selector.wallet();
  return wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: contractId,
    actions: [
      actionCreators.functionCall(
        methodName,
        args,
        BigInt("30000000000000"),
        BigInt(depositYocto),
      ),
    ],
  });
}

export async function readNearContract<T>(method: string, args: Record<string, unknown>): Promise<T> {
  if (!isNearConfigured()) {
    throw new Error("Set VITE_NEAR_CONTRACT_ID to read testnet state.");
  }
  providerPromise ??= import("near-api-js").then(({ JsonRpcProvider }) => new JsonRpcProvider({ url: rpcUrl }));
  const provider = await providerPromise;
  const response = await provider.callFunctionRaw({ contractId, method, args });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(response.result))) as T;
}
