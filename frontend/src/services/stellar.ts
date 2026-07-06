import {
  rpc,
  Transaction,
  TransactionBuilder,
  Networks,
  Address,
  scValToNative,
  nativeToScVal,
  xdr,
} from "stellar-sdk";

export const NETWORK_DETAILS = {
  testnet: {
    networkPassphrase: Networks.TESTNET,
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

// Simple custom error wrapper for transaction errors
export class TxError extends Error {
  constructor(public hash: string, message: string, public code?: string) {
    super(message);
    this.name = "TxError";
  }
}

export class StellarService {
  private server: rpc.Server;
  private passphrase: string;
  private network: NetworkType;

  constructor(network: NetworkType = "testnet") {
    this.network = network;
    const details = NETWORK_DETAILS[network];
    this.server = new rpc.Server(details.rpcUrl);
    this.passphrase = details.networkPassphrase;
  }

  getNetworkDetails() {
    return NETWORK_DETAILS[this.network];
  }

  getRpcServer() {
    return this.server;
  }

  /**
   * Submits a signed transaction envelope and polls until completion.
   */
  async submitTransaction(
    txEnvelopeXdr: string,
    onStatusChange?: (status: "submitting" | "pending" | "processing" | "confirmed" | "failed", extra?: string) => void
  ): Promise<{ hash: string; resultXdr: string; ledger: number }> {
    onStatusChange?.("submitting");
    const tx = new Transaction(txEnvelopeXdr, this.passphrase);
    const txHash = tx.hash().toString("hex");

    try {
      let response = await this.server.sendTransaction(tx);
      
      if (response.status === "ERROR") {
        throw new TxError(txHash, "Transaction submission failed instantly", response.errorResultXdr);
      }

      onStatusChange?.("processing");
      
      // Poll for completion (up to 12 attempts, every 2s)
      for (let i = 0; i < 12; i++) {
        const statusResponse = await this.server.getTransaction(txHash);

        if (statusResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          onStatusChange?.("confirmed");
          return {
            hash: txHash,
            resultXdr: statusResponse.resultXdr,
            ledger: statusResponse.ledger,
          };
        }

        if (statusResponse.status === rpc.Api.GetTransactionStatus.FAILED) {
          throw new TxError(txHash, "Transaction execution failed on ledger", statusResponse.resultMetaXdr);
        }

        // Wait 2 seconds before polling again
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      throw new TxError(txHash, "Transaction timed out during confirmation polling");
    } catch (err: any) {
      onStatusChange?.("failed", err.message);
      throw err;
    }
  }

  /**
   * Helper to parse a return value from an XDR transaction result
   */
  parseTxResult(resultXdrHex: string): any {
    const resultXdr = xdr.TransactionResult.fromXDR(resultXdrHex, "base64");
    
    // In Soroban, the return value is wrapped in the transaction meta.
    // If we call parseTxResult, we check the structure.
    try {
      const operationResults = resultXdr.result().results();
      if (operationResults.length > 0) {
        const opResult = operationResults[0];
        const tr = opResult.tr().sorobanTransactionData();
        // Return native parsed value if structure allows
        return tr;
      }
    } catch (e) {
      console.warn("Failed parsing XDR results: ", e);
    }
    return null;
  }
}
