/**
 * WalletService — wraps @creit.tech/stellar-wallets-kit v2 static API.
 *
 * v2 uses a fully static class: no `new StellarWalletsKit()`.
 * All interactions go through StellarWalletsKit.init(), .setWallet(), etc.
 */
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";

export type SupportedWalletId = "freighter" | "xbull";

export class WalletService {
  private selectedModuleId: SupportedWalletId | null = null;
  private initialized = false;

  constructor(network: "testnet" | "standalone" = "testnet") {
    const targetNetwork =
      network === "standalone" ? Networks.STANDALONE : Networks.TESTNET;

    // Static init — registers modules globally for this page session
    StellarWalletsKit.init({
      modules: [new FreighterModule(), new xBullModule()],
      network: targetNetwork,
    });
    this.initialized = true;
  }

  /**
   * Connect wallet and return the user's public key.
   */
  async connect(moduleId: SupportedWalletId = "freighter"): Promise<string> {
    if (!this.initialized) throw new Error("WalletService not initialized");

    try {
      this.selectedModuleId = moduleId;
      StellarWalletsKit.setWallet(moduleId);

      const { address } = await StellarWalletsKit.getAddress();
      if (!address) throw new Error("No account address returned from wallet.");
      return address;
    } catch (err: any) {
      this.selectedModuleId = null;
      if (err.message?.includes("User reject")) {
        throw new Error("Connection request cancelled by user.");
      }
      if (err.message?.includes("not installed") || err.code === -3) {
        throw new Error(`The selected wallet (${moduleId}) is not installed.`);
      }
      throw new Error(err.message || "Failed to connect wallet.");
    }
  }

  /**
   * Sign a transaction XDR with the connected wallet.
   */
  async signTransaction(xdrEnvelope: string, userAddress: string): Promise<string> {
    if (!this.selectedModuleId) throw new Error("No wallet connected.");

    try {
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(
        xdrEnvelope,
        { address: userAddress }
      );
      return signedTxXdr;
    } catch (err: any) {
      if (
        err.message?.includes("User reject") ||
        err.message?.includes("declined")
      ) {
        throw new Error("Transaction signing rejected by user.");
      }
      throw new Error(err.message || "Transaction signing failed.");
    }
  }

  /**
   * Disconnect / clear the selected wallet module.
   */
  disconnect() {
    this.selectedModuleId = null;
    try {
      StellarWalletsKit.disconnect();
    } catch {
      // disconnect may not be available in all wallet states
    }
  }
}
