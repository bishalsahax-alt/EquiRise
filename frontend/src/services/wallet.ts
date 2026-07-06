import {
  StellarWalletsKit,
  FreighterModule,
  XBullModule,
  WalletType,
} from "@creit.tech/stellar-wallets-kit";
import { Networks } from "stellar-sdk";

export class WalletService {
  private kit: StellarWalletsKit;
  private selectedWallet: WalletType | null = null;

  constructor(network: "testnet" | "standalone" = "testnet") {
    const targetNetwork =
      network === "standalone" 
        ? "Standalone Network ; Standalone Network" 
        : Networks.TESTNET;

    this.kit = new StellarWalletsKit({
      network: targetNetwork,
      modules: [
        new FreighterModule(),
        new XBullModule(),
      ],
    });
  }

  /**
   * Connect wallet and return public key
   */
  async connect(walletType: WalletType = WalletType.FREIGHTER): Promise<string> {
    try {
      this.selectedWallet = walletType;
      await this.kit.setWallet(walletType);
      
      const { address } = await this.kit.getAddress();
      if (!address) {
        throw new Error("No account address returned from wallet.");
      }
      return address;
    } catch (err: any) {
      this.selectedWallet = null;
      if (err.message?.includes("User reject")) {
        throw new Error("Connection request cancelled by user.");
      }
      if (err.message?.includes("not installed")) {
        throw new Error(`The selected wallet (${walletType}) is not installed.`);
      }
      throw new Error(err.message || "Failed to connect wallet.");
    }
  }

  /**
   * Sign transaction using the connected wallet
   */
  async signTransaction(xdrEnvelope: string, userAddress: string): Promise<string> {
    if (!this.selectedWallet) {
      throw new Error("No wallet connected.");
    }
    try {
      const { signedTxXdr } = await this.kit.signTx({
        xdr: xdrEnvelope,
        publicKey: userAddress,
      });
      return signedTxXdr;
    } catch (err: any) {
      if (err.message?.includes("User reject") || err.message?.includes("declined")) {
        throw new Error("Transaction signing rejected by user.");
      }
      throw new Error(err.message || "Transaction signing failed.");
    }
  }

  /**
   * Disconnect the wallet
   */
  disconnect() {
    this.selectedWallet = null;
  }
}
