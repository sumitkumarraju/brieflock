/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEAR_NETWORK?: "testnet" | "mainnet";
  readonly VITE_NEAR_CONTRACT_ID?: string;
  readonly VITE_NEAR_MILESTONE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
