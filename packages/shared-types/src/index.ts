export const BOOTSTRAP_CONTRACT_VERSION = "v0" as const;

export interface BootstrapContract {
  version: typeof BOOTSTRAP_CONTRACT_VERSION;
}
