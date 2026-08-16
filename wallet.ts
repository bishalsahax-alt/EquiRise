/**
 * WalletService — Root Wallet Connection Service
 * Uses @creit.tech/stellar-wallets-kit v2 API.
 *
 * Provides full implementation for:
 *   - StellarWalletsKit.init({ modules, network })
 *   - StellarWalletsKit.setWallet(id)
 *   - StellarWalletsKit.fetchAddress()
 *   - StellarWalletsKit.getAddress()
 *   - StellarWalletsKit.signTransaction(xdr, opts)
 *   - StellarWalletsKit.disconnect()
 */

export type SupportedWalletId = "freighter" | "xbull";

export interface WalletInfo {
  id: SupportedWalletId;
  name: string;
  description: string;
  icon: string;
  installUrl: string;
}

export const SUPPORTED_WALLETS: WalletInfo[] = [
  {
    id: "freighter",
    name: "Freighter",
    description: "Official Stellar browser wallet extension by SDF",
    icon: "🚀",
    installUrl: "https://freighter.app",
  },
  {
    id: "xbull",
    name: "xBull",
    description: "Feature-rich multi-network Stellar wallet",
    icon: "🐂",
    installUrl: "https://xbull.app",
  },
];

export type NetworkParam = "testnet" | "standalone";

export class WalletService {
  private selectedModuleId: SupportedWalletId | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private network: NetworkParam;

  constructor(network: NetworkParam = "testnet") {
    this.network = network;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const [
        { StellarWalletsKit },
        { FreighterModule },
        { xBullModule },
        { Networks },
      ] = await Promise.all([
        import("@creit.tech/stellar-wallets-kit/sdk"),
        import("@creit.tech/stellar-wallets-kit/modules/freighter"),
        import("@creit.tech/stellar-wallets-kit/modules/xbull"),
        import("@creit.tech/stellar-wallets-kit/types"),
      ]);

      const targetNetwork =
        this.network === "standalone" ? Networks.STANDALONE : Networks.TESTNET;

      StellarWalletsKit.init({
        modules: [new FreighterModule(), new xBullModule()],
        network: targetNetwork,
      });

      this.initialized = true;
    })();

    return this.initPromise;
  }

  async connect(moduleId: SupportedWalletId = "freighter"): Promise<string> {
    await this.ensureInitialized();

    const { StellarWalletsKit } = await import(
      "@creit.tech/stellar-wallets-kit/sdk"
    );

    try {
      this.selectedModuleId = moduleId;
      StellarWalletsKit.setWallet(moduleId);

      const { address } = await StellarWalletsKit.fetchAddress();
      if (!address) throw new Error("No account address returned from wallet.");
      return address;
    } catch (err: any) {
      this.selectedModuleId = null;
      if (err?.code === -3 || err?.message?.includes("not installed")) {
        const walletInfo = SUPPORTED_WALLETS.find((w) => w.id === moduleId);
        throw new Error(
          `${walletInfo?.name ?? moduleId} is not installed. Install at ${walletInfo?.installUrl}`
        );
      }
      if (err?.message?.includes("User reject") || err?.code === 4001) {
        throw new Error("Connection request was rejected by user.");
      }
      throw new Error(err?.message || "Failed to connect wallet.");
    }
  }

  async signTransaction(xdrEnvelope: string, userAddress: string): Promise<string> {
    if (!this.selectedModuleId) throw new Error("No wallet connected.");

    const { StellarWalletsKit } = await import(
      "@creit.tech/stellar-wallets-kit/sdk"
    );

    try {
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(
        xdrEnvelope,
        { address: userAddress }
      );
      return signedTxXdr;
    } catch (err: any) {
      if (
        err?.message?.includes("User reject") ||
        err?.message?.includes("declined") ||
        err?.code === 4001
      ) {
        throw new Error("Transaction signing rejected by user.");
      }
      throw new Error(err?.message || "Transaction signing failed.");
    }
  }

  disconnect() {
    this.selectedModuleId = null;
    try {
      if (this.initialized) {
        import("@creit.tech/stellar-wallets-kit/sdk").then(
          ({ StellarWalletsKit }) => {
            StellarWalletsKit.disconnect();
          }
        );
      }
    } catch {
      // safe to ignore
    }
  }

  getSelectedWalletId(): SupportedWalletId | null {
    return this.selectedModuleId;
  }
}
