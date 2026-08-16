/**
 * StellarService — Root level Stellar SDK RPC client layer.
 * Uses @stellar/stellar-sdk dynamically for RPC submission, TransactionBuilder,
 * and contract simulation polling.
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

  getRpcServer(): any {
    if (!this._server) {
      throw new Error("getRpcServer() called before server is ready. Use getServerAsync() instead.");
    }
    return this._server;
  }

  async getServerAsync(): Promise<any> {
    if (!this._server) {
      const { rpc } = await import("@stellar/stellar-sdk");
      this._server = new rpc.Server(this.rpcUrl);
    }
    return this._server;
  }

  async submitTransaction(
    txEnvelopeXdr: string,
    onStatusChange?: (
      status: "submitting" | "pending" | "processing" | "confirmed" | "failed",
      extra?: string
    ) => void
  ): Promise<{ hash: string; resultXdr: any; returnValue?: any; ledger: number }> {
    const { Transaction, rpc } = await import("@stellar/stellar-sdk");
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
            returnValue: statusResponse.returnValue,
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

  async buildPaymentTx(
    fromAddress: string,
    toAddress: string,
    amount: string
  ): Promise<any> {
    const { Account, Operation, TransactionBuilder, Asset } = await import("@stellar/stellar-sdk");
    const server = await this.getServerAsync();

    const accountData = await server.getAccount(fromAddress).catch(() => {
      throw new Error(`Source account ${fromAddress.slice(0, 6)}... not found on ${this.network}.`);
    });

    const op = Operation.payment({
      destination: toAddress,
      asset: Asset.native(),
      amount: amount,
    });

    const tx = new TransactionBuilder(
      new Account(fromAddress, accountData.sequenceNumber()),
      {
        fee: "100000",
        networkPassphrase: this.passphrase,
      }
    )
      .addOperation(op)
      .setTimeout(100)
      .build();

    return tx;
  }
}
