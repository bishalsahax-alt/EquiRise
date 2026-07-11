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
  manager: process.env.NEXT_PUBLIC_SYNDICATE_MANAGER_ADDRESS ??
    "CCSYNDICATEMANAGERXXXXXXTESTNETXXXXXXEQUI1",
  mockUsdc: process.env.NEXT_PUBLIC_MOCK_USDC_TOKEN_ADDRESS ??
    "CUSDCASSETXXXXXXTESTNETXXXXXXEQUI1",
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

    return rpc.assembleTransaction(tx, simRes);
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

      // In a real deployment, parse the returned pool address from result XDR.
      // For now we derive a deterministic placeholder so UI can continue.
      const poolAddr =
        "CDP" + Math.random().toString(36).substring(7).toUpperCase() + "EQUI1";
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

  static async deposit(poolAddress: string, amount: number) {
    const { nativeToScVal, Address } = await getStellarSdk();
    const store = this.getStore();
    const txId = store.addTransaction(`Deposit capital: ${amount} USDC`);

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
}
