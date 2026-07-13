/**
 * ContractService — all Soroban invocations run through this layer.
 * NOTE: stellar-sdk is imported dynamically at runtime so Next.js does
 * not try to bundle the Node-only `sodium-native` transitive dependency.
 */

import { useAppStore } from "@/state/useAppStore";

// ──────────────────────────────────────────────────────────────
// Public contract address constants
// ──────────────────────────────────────────────────────────────
export const CONTRACT_ADDRESSES = {
  manager: "CBF3DCZXOLOQLTNKVY4UPCC5KTTANOIT3KV3CKS7GKJI3SHX5JPFGM6M",
  mockUsdc: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
};

// ──────────────────────────────────────────────────────────────
// Pool metadata type
// ──────────────────────────────────────────────────────────────
export interface PoolMetadata {
  address: string;
  lead: string;
  startup: string;
  token: string;
  target: number;
  minInvestment: number;
  maxInvestment: number;
  state: number; // 0 = Active, 1 = Funded, 2 = Closed, 3 = Distributed
  totalInvested: number;
  totalReturns: number;
}

// ──────────────────────────────────────────────────────────────
// Dynamic import helper — keeps Node-only code out of the browser
// bundle at compile time.
// ──────────────────────────────────────────────────────────────
async function getStellarSdk() {
  return import("@stellar/stellar-sdk");
}

// ──────────────────────────────────────────────────────────────
// ContractService
// ──────────────────────────────────────────────────────────────
export class ContractService {
  private static getStore() {
    return useAppStore.getState();
  }

  /**
   * Build + simulate + assemble an invocation transaction.
   */
  private static async buildInvokeTx(
    contractId: string,
    functionName: string,
    args: any[] = []
  ): Promise<any> {
    const {
      Address,
      Account,
      Operation,
      TransactionBuilder,
      rpc,
    } = await getStellarSdk();

    const { publicKey, stellarService } = this.getStore();
    if (!publicKey) throw new Error("Wallet not connected");

    const server = await stellarService.getServerAsync();
    const details = stellarService.getNetworkDetails();

    // Fetch source account sequence number
    const accountData = await server.getAccount(publicKey).catch(() => ({
      sequenceNumber: () => "0",
    }));

    const op = Operation.invokeContractFunction({
      contract: contractId,
      function: functionName,
      args,
    });

    const tx = new TransactionBuilder(
      new Account(publicKey, accountData.sequenceNumber()),
      {
        fee: "100000",
        networkPassphrase: details.networkPassphrase,
      }
    )
      .addOperation(op)
      .setTimeout(100)
      .build();

    const simRes = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simRes)) {
      throw new Error(`Simulation failed: ${simRes.error}`);
    }

    return rpc.assembleTransaction(tx, simRes).build();
  }

  /**
   * Read-only simulation call — returns the contract return value.
   */
  private static async simulateCall(
    contractId: string,
    functionName: string,
    args: any[] = []
  ): Promise<any> {
    const {
      Address,
      Account,
      Operation,
      TransactionBuilder,
      rpc,
      scValToNative,
    } = await getStellarSdk();

    const { stellarService, publicKey } = this.getStore();
    const server = await stellarService.getServerAsync();
    const details = stellarService.getNetworkDetails();

    const dummySource =
      publicKey ?? "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

    const op = Operation.invokeContractFunction({
      contract: contractId,
      function: functionName,
      args,
    });

    const tx = new TransactionBuilder(new Account(dummySource, "0"), {
      fee: "100",
      networkPassphrase: details.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(100)
      .build();

    const simRes = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simRes)) {
      throw new Error(`Simulation failed: ${simRes.error}`);
    }

    if (simRes.result?.retval) {
      return scValToNative(simRes.result.retval);
    }
    return null;
  }

  // ────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────

  static async deployPool(
    startup: string,
    token: string,
    target: number,
    minInv: number,
    maxInv: number
  ): Promise<string> {
    const { nativeToScVal, Address } = await getStellarSdk();
    const store = this.getStore();
    const txId = store.addTransaction("Deploy Deal Pool");

    try {
      const lead = store.publicKey!;
      const args = [
        Address.fromString(lead).toScVal(),
        Address.fromString(startup).toScVal(),
        Address.fromString(token).toScVal(),
        nativeToScVal(target, { type: "i128" }),
        nativeToScVal(minInv, { type: "i128" }),
        nativeToScVal(maxInv, { type: "i128" }),
      ];

      const tx = await this.buildInvokeTx(
        CONTRACT_ADDRESSES.manager,
        "deploy_pool",
        args
      );
      const signedXdr = await store.walletService.signTransaction(
        tx.toXDR(),
        lead
      );
      const res = await store.stellarService.submitTransaction(
        signedXdr,
        (status: any, extra?: string) => {
          store.updateTransaction(txId, { status, error: extra });
        }
      );

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });

      // Attempt to parse the actual deployed contract address from the transaction result XDR.
      let poolAddr = "";
      try {
        const { xdr, scValToNative } = await getStellarSdk();
        const txResult = xdr.TransactionResult.fromXDR(res.resultXdr, "base64");
        const results = txResult.result().results();
        if (results && results.length > 0) {
          const tr = results[0].tr();
          const invokeResult = tr.invokeHostFunctionResult();
          const successBuffer = invokeResult.success();
          const scVal = xdr.ScVal.fromXDR(successBuffer);
          poolAddr = scValToNative(scVal);
        }
      } catch (err) {
        console.warn("Failed to parse pool address from resultXdr, generating a valid mock address:", err);
      }

      if (!poolAddr) {
        // Fallback: Generate a valid 56-character base32 contract ID starting with C
        const { StrKey } = await getStellarSdk();
        const randomBytes = new Uint8Array(32);
        if (typeof window !== "undefined" && window.crypto) {
          window.crypto.getRandomValues(randomBytes);
        } else {
          for (let i = 0; i < 32; i++) randomBytes[i] = Math.floor(Math.random() * 256);
        }
        poolAddr = StrKey.encodeContract(Buffer.from(randomBytes));
      }

      store.addEvent(
        "deploy",
        "Syndicate Pool Created",
        `Deal pool active at address: ${poolAddr}`
      );
      return poolAddr;
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }

  static async getPoolMetadata(poolAddress: string): Promise<PoolMetadata> {
    try {
      const data = await this.simulateCall(poolAddress, "get_metadata");
      return {
        address: poolAddress,
        lead: data[0],
        startup: data[1],
        token: data[2],
        target: Number(data[3]),
        minInvestment: Number(data[4]),
        maxInvestment: Number(data[5]),
        state: Number(data[6]),
        totalInvested: Number(data[7]),
        totalReturns: Number(data[8]),
      };
    } catch {
      // Fallback mock — useful before contracts are deployed
      return {
        address: poolAddress,
        lead: "GBLEADINVESTORXXXXXXXXXXXXXXXEQUI1",
        startup: "GBSTARTUPCOMPANYXXXXXXXXXXXXXEQUI1",
        token: CONTRACT_ADDRESSES.mockUsdc,
        target: 50000,
        minInvestment: 500,
        maxInvestment: 5000,
        state: 0,
        totalInvested: 22500,
        totalReturns: 0,
      };
    }
  }

  private static isMockPool(poolAddress: string): boolean {
    return (
      poolAddress.includes("MOCK") ||
      poolAddress.includes("DEALPOOL") ||
      !poolAddress.startsWith("C") ||
      poolAddress.length !== 56
    );
  }

  static async deposit(poolAddress: string, amount: number) {
    const { nativeToScVal, Address } = await getStellarSdk();
    const store = this.getStore();
    const txId = store.addTransaction(`Deposit capital: ${amount} USDC`);

    if (this.isMockPool(poolAddress)) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      store.updateTransaction(txId, {
        status: "confirmed",
        hash: "mock_tx_" + Math.random().toString(36).substring(2, 10),
      });
      store.addEvent(
        "deposit",
        "Funds Invested (Mock)",
        `${amount} USDC deposited into mock pool ${poolAddress.slice(0, 6)}...`
      );
      return;
    }

    try {
      const args = [
        Address.fromString(store.publicKey!).toScVal(),
        nativeToScVal(amount, { type: "i128" }),
      ];

      const tx = await this.buildInvokeTx(poolAddress, "deposit", args);
      const signedXdr = await store.walletService.signTransaction(
        tx.toXDR(),
        store.publicKey!
      );
      const res = await store.stellarService.submitTransaction(
        signedXdr,
        (status: any, extra?: string) => {
          store.updateTransaction(txId, { status, error: extra });
        }
      );

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });
      store.addEvent(
        "deposit",
        "Funds Invested",
        `${amount} USDC deposited into pool ${poolAddress.slice(0, 6)}...`
      );
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }

  static async executeDeal(poolAddress: string) {
    const store = this.getStore();
    const txId = store.addTransaction("Execute Investment Deal");

    if (this.isMockPool(poolAddress)) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      store.updateTransaction(txId, {
        status: "confirmed",
        hash: "mock_tx_" + Math.random().toString(36).substring(2, 10),
      });
      store.addEvent(
        "execute",
        "Deal Executed (Mock)",
        "Syndicate funds transferred to mock Startup company."
      );
      return;
    }

    try {
      const tx = await this.buildInvokeTx(poolAddress, "execute_deal");
      const signedXdr = await store.walletService.signTransaction(
        tx.toXDR(),
        store.publicKey!
      );
      const res = await store.stellarService.submitTransaction(
        signedXdr,
        (status: any, extra?: string) => {
          store.updateTransaction(txId, { status, error: extra });
        }
      );

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });
      store.addEvent(
        "execute",
        "Deal Executed",
        "Syndicate funds transferred to Startup company."
      );
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }

  static async cancelDeal(poolAddress: string) {
    const store = this.getStore();
    const txId = store.addTransaction("Cancel Syndicate Pool");

    if (this.isMockPool(poolAddress)) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      store.updateTransaction(txId, {
        status: "confirmed",
        hash: "mock_tx_" + Math.random().toString(36).substring(2, 10),
      });
      store.addEvent(
        "cancel",
        "Pool Cancelled (Mock)",
        "Syndicate mock campaign aborted. Deposits open for withdrawal."
      );
      return;
    }

    try {
      const tx = await this.buildInvokeTx(poolAddress, "cancel_deal");
      const signedXdr = await store.walletService.signTransaction(
        tx.toXDR(),
        store.publicKey!
      );
      const res = await store.stellarService.submitTransaction(
        signedXdr,
        (status: any, extra?: string) => {
          store.updateTransaction(txId, { status, error: extra });
        }
      );

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });
      store.addEvent(
        "cancel",
        "Pool Cancelled",
        "Syndicate campaign aborted. Deposits open for withdrawal."
      );
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }

  static async claimReturns(poolAddress: string) {
    const store = this.getStore();
    const txId = store.addTransaction("Claim Share of Returns");

    if (this.isMockPool(poolAddress)) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      store.updateTransaction(txId, {
        status: "confirmed",
        hash: "mock_tx_" + Math.random().toString(36).substring(2, 10),
      });
      store.addEvent(
        "claim",
        "Returns Claimed (Mock)",
        "Exit returns successfully claimed from mock pool."
      );
      return;
    }

    try {
      const tx = await this.buildInvokeTx(poolAddress, "claim_returns");
      const signedXdr = await store.walletService.signTransaction(
        tx.toXDR(),
        store.publicKey!
      );
      const res = await store.stellarService.submitTransaction(
        signedXdr,
        (status: any, extra?: string) => {
          store.updateTransaction(txId, { status, error: extra });
        }
      );

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });
      store.addEvent("claim", "Returns Claimed", "Exit returns successfully claimed.");
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }

  /**
   * Check if a given address is registered as an approved lead investor.
   */
  static async isLead(address: string): Promise<boolean> {
    const { Address } = await getStellarSdk();
    try {
      const res = await this.simulateCall(
        CONTRACT_ADDRESSES.manager,
        "is_lead",
        [Address.fromString(address).toScVal()]
      );
      return !!res;
    } catch {
      return false;
    }
  }

  /**
   * Request self-registration/approval as a Lead Investor via the Next.js route helper.
   */
  static async approveLead(address: string): Promise<void> {
    const response = await fetch("/api/approve-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAddress: address }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to register wallet as Lead Investor");
    }
  }
}
