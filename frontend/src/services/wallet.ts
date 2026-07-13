/**
 * WalletService — wraps @creit.tech/stellar-wallets-kit v2 static API.
 *
 * Correct flow per v2 docs:
 *  1. StellarWalletsKit.init({ modules, network })  — once on boot
 *  2. StellarWalletsKit.setWallet(id)               — select wallet
 *  3. StellarWalletsKit.fetchAddress()              — prompt user, store address
 *  4. StellarWalletsKit.getAddress()                — read cached address
 *  5. StellarWalletsKit.signTransaction(xdr, opts)  — sign XDR
 *
 * PERFORMANCE: All wallet-kit imports are dynamic so the heavy bundle
 * (Trezor, Solana polyfills, protobuf, etc.) is only loaded when the
 * user actually clicks "Connect Wallet", not on initial page load.
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
    description: "Official Stellar browser wallet by SDF",
    icon: "🚀",
    installUrl: "https://freighter.app",
  },
  {
    id: "xbull",
    name: "xBull",
    description: "Feature-rich Stellar wallet",
    icon: "🐂",
    installUrl: "https://xbull.app",
  },
];

type NetworkParam = "testnet" | "standalone";

export class WalletService {
  private selectedModuleId: SupportedWalletId | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private network: NetworkParam;

  constructor(network: NetworkParam = "testnet") {
    // Store the network but DON'T init the wallet kit yet — it's heavy.
    this.network = network;
  }

  /**
   * Lazily initialise StellarWalletsKit on first use.
   * Dynamic imports ensure the ~2 MB wallet-kit bundle is only
   * fetched when the user actually tries to connect.
   */
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

  /**
   * Connect a specific wallet by id. Prompts the wallet extension.
   */
  async connect(moduleId: SupportedWalletId = "freighter"): Promise<string> {
    await this.ensureInitialized();

    const { StellarWalletsKit } = await import(
      "@creit.tech/stellar-wallets-kit/sdk"
    );

    try {
      this.selectedModuleId = moduleId;
      StellarWalletsKit.setWallet(moduleId);

      // fetchAddress prompts the wallet extension and stores the address
      const { address } = await StellarWalletsKit.fetchAddress();
      if (!address) throw new Error("No account address returned from wallet.");
      return address;
    } catch (err: any) {
      this.selectedModuleId = null;
      // Code -3: wallet not installed / no module selected
      if (err?.code === -3 || err?.message?.includes("not installed")) {
        const walletInfo = SUPPORTED_WALLETS.find((w) => w.id === moduleId);
        throw new Error(
          `${walletInfo?.name ?? moduleId} is not installed. Install it at ${walletInfo?.installUrl}`
        );
      }
      if (err?.message?.includes("User reject") || err?.code === 4001) {
        throw new Error("Connection request was rejected by user.");
      }
      throw new Error(err?.message || "Failed to connect wallet.");
    }
  }

  /**
   * Sign a transaction XDR with the connected wallet.
   */
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

  /**
   * Disconnect / clear the selected wallet module.
   */
  disconnect() {
    this.selectedModuleId = null;
    try {
      // Only attempt disconnect if we were initialized
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
