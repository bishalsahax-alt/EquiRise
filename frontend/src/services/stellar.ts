/**
 * StellarService — all stellar-sdk usage is gated behind dynamic imports
 * so Next.js never statically bundles sodium-native into the browser chunk.
 */

export const NETWORK_DETAILS = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/testnet",
  },
  standalone: {
    networkPassphrase: "Standalone Network ; Standalone Network",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    explorerUrl: "http://localhost:8000",
  },
};

export type NetworkType = "testnet" | "standalone";

export class TxError extends Error {
  constructor(
    public hash: string,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "TxError";
  }
}

export class StellarService {
  private rpcUrl: string;
  private passphrase: string;
  private network: NetworkType;
  // Server instance is created lazily via dynamic import
  private _server: any = null;

  constructor(network: NetworkType = "testnet") {
    this.network = network;
    const details = NETWORK_DETAILS[network];
    this.rpcUrl = details.rpcUrl;
    this.passphrase = details.networkPassphrase;
  }

  getNetworkDetails() {
    return NETWORK_DETAILS[this.network];
  }

  /** Returns a lazily-created RPC server instance. */
  getRpcServer(): any {
    if (!this._server) {
      // Return a proxy object whose methods resolve lazily.
      // In practice, contract calls happen async so this is safe.
      throw new Error(
        "getRpcServer() called before server is ready. Use getServerAsync() instead."
      );
    }
    return this._server;
  }

  /** Async version — always use this before any network call. */
  async getServerAsync(): Promise<any> {
    if (!this._server) {
      const { rpc } = await import("stellar-sdk");
      this._server = new rpc.Server(this.rpcUrl);
    }
    return this._server;
  }

  /**
   * Submits a signed transaction envelope and polls until completion.
   */
  async submitTransaction(
    txEnvelopeXdr: string,
    onStatusChange?: (
      status: "submitting" | "pending" | "processing" | "confirmed" | "failed",
      extra?: string
    ) => void
  ): Promise<{ hash: string; resultXdr: string; ledger: number }> {
    const { Transaction, rpc } = await import("stellar-sdk");
    const server = await this.getServerAsync();

    onStatusChange?.("submitting");

    const tx = new Transaction(txEnvelopeXdr, this.passphrase);
    const txHash = tx.hash().toString("hex");

    try {
      const response = await server.sendTransaction(tx);

      if (response.status === "ERROR") {
        throw new TxError(
          txHash,
          "Transaction submission failed instantly",
          String(response.errorResult ?? "")
        );
      }

      onStatusChange?.("processing");

      for (let i = 0; i < 12; i++) {
        const statusResponse = await server.getTransaction(txHash);

        if (statusResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          onStatusChange?.("confirmed");
          return {
            hash: txHash,
            resultXdr: statusResponse.resultXdr,
            ledger: statusResponse.ledger,
          };
        }

        if (statusResponse.status === rpc.Api.GetTransactionStatus.FAILED) {
          throw new TxError(
            txHash,
            "Transaction execution failed on ledger",
            statusResponse.resultMetaXdr
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      throw new TxError(txHash, "Transaction timed out during confirmation polling");
    } catch (err: any) {
      onStatusChange?.("failed", err.message);
      throw err;
    }
  }
}
