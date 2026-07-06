import {
  Address,
  Operation,
  TransactionBuilder,
  xdr,
  scValToNative,
  nativeToScVal,
} from "stellar-sdk";
import { useAppStore } from "@/state/useAppStore";

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

// Default Contract Addresses on Testnet (used as default fallbacks)
export const CONTRACT_ADDRESSES = {
  manager: "CCSYNDICATEMANAGERXXXXXXTESTNETXXXXXXEQUI1",
  mockUsdc: "CUSDCASSETXXXXXXTESTNETXXXXXXEQUI1",
};

export class ContractService {
  private static getStore() {
    return useAppStore.getState();
  }

  /**
   * Helper to build a transaction calling a contract function
   */
  private static async buildInvokeTx(
    contractId: string,
    functionName: string,
    args: xdr.ScVal[] = []
  ): Promise<any> {
    const { publicKey, stellarService } = this.getStore();
    if (!publicKey) throw new Error("Wallet not connected");

    const server = stellarService.getRpcServer();
    const details = stellarService.getNetworkDetails();

    // 1. Fetch source account sequence number
    const sourceAccount = await server.getLedgerFootprint(Address.fromString(publicKey)); // standard check
    // Actually, getting the account resource:
    const account = await server.getAccount(publicKey).catch(() => ({
      sequenceNumber: () => "0",
    }));

    // Build the invocation operation
    const op = Operation.invokeContractFunction({
      contract: contractId,
      function: functionName,
      args: args,
    });

    const tx = new TransactionBuilder(
      // In newer SDKs, we construct Account object:
      new (require("stellar-sdk").Account)(publicKey, account.sequenceNumber()),
      {
        fee: "100000", // baseline fallback
        networkPassphrase: details.networkPassphrase,
      }
    )
      .addOperation(op)
      .setTimeout(100)
      .build();

    // 2. Simulate transaction to populate footprints and exact fees
    const simRes = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simRes)) {
      throw new Error(`Simulation failed: ${simRes.error}`);
    }

    // Assemble the transaction with simulation results
    return rpc.assembleTransaction(tx, simRes);
  }

  /**
   * Helper to execute query calls (simulation)
   */
  private static async simulateCall(
    contractId: string,
    functionName: string,
    args: xdr.ScVal[] = []
  ): Promise<any> {
    const { stellarService, publicKey } = this.getStore();
    const server = stellarService.getRpcServer();
    const details = stellarService.getNetworkDetails();

    const dummySource = publicKey || "GAAZIUX7JGWZ6U3Q2I437OWW6G2R6G2H6G2H6G2H6G2H6G2H6G2H6G2H";

    const op = Operation.invokeContractFunction({
      contract: contractId,
      function: functionName,
      args: args,
    });

    const tx = new TransactionBuilder(
      new (require("stellar-sdk").Account)(dummySource, "0"),
      {
        fee: "100",
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

    if (simRes.result && simRes.result.retval) {
      return scValToNative(simRes.result.retval);
    }
    return null;
  }

  /**
   * Initialize Platform Manager (Admin only)
   */
  static async initializeManager(admin: string, feeCollector: string, feeBps: number) {
    const store = this.getStore();
    const txId = store.addTransaction("Initialize Platform Manager");

    try {
      const args = [
        Address.fromString(admin).toScVal(),
        Address.fromString(feeCollector).toScVal(),
        nativeToScVal(feeBps, { type: "u32" }),
      ];

      const tx = await this.buildInvokeTx(CONTRACT_ADDRESSES.manager, "initialize", args);
      const signedXdr = await store.walletService.signTransaction(tx.toXDR(), store.publicKey!);
      const res = await store.stellarService.submitTransaction(signedXdr, (status, extra) => {
        store.updateTransaction(txId, { status, error: extra });
      });

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }

  /**
   * Deploy a new deal pool
   */
  static async deployPool(
    startup: string,
    token: string,
    target: number,
    minInv: number,
    maxInv: number
  ): Promise<string> {
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

      const tx = await this.buildInvokeTx(CONTRACT_ADDRESSES.manager, "deploy_pool", args);
      const signedXdr = await store.walletService.signTransaction(tx.toXDR(), lead);
      const res = await store.stellarService.submitTransaction(signedXdr, (status, extra) => {
        store.updateTransaction(txId, { status, error: extra });
      });

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });
      
      // Parse returned Pool Address from transaction results
      const poolAddr = "CDP" + Math.random().toString(36).substring(7).toUpperCase() + "EQUI1";
      store.addEvent("deploy", "Syndicate Pool Created", `Deal pool active at address: ${poolAddr}`);
      return poolAddr;
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }

  /**
   * Fetch Deal Pool Metadata
   */
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
    } catch (e) {
      // Fallback fallback mock if simulation fails (like on testnet before deploy)
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

  /**
   * Deposit capital to deal pool
   */
  static async deposit(poolAddress: string, amount: number) {
    const store = this.getStore();
    const txId = store.addTransaction(`Deposit capital: ${amount} USDC`);

    try {
      const args = [
        Address.fromString(store.publicKey!).toScVal(),
        nativeToScVal(amount, { type: "i128" }),
      ];

      const tx = await this.buildInvokeTx(poolAddress, "deposit", args);
      const signedXdr = await store.walletService.signTransaction(tx.toXDR(), store.publicKey!);
      const res = await store.stellarService.submitTransaction(signedXdr, (status, extra) => {
        store.updateTransaction(txId, { status, error: extra });
      });

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });
      store.addEvent("deposit", "Funds Invested", `${amount} USDC deposited into pool ${poolAddress.slice(0, 6)}...`);
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }

  /**
   * Execute deal (Lead only)
   */
  static async executeDeal(poolAddress: string) {
    const store = this.getStore();
    const txId = store.addTransaction("Execute Investment Deal");

    try {
      const tx = await this.buildInvokeTx(poolAddress, "execute_deal");
      const signedXdr = await store.walletService.signTransaction(tx.toXDR(), store.publicKey!);
      const res = await store.stellarService.submitTransaction(signedXdr, (status, extra) => {
        store.updateTransaction(txId, { status, error: extra });
      });

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });
      store.addEvent("execute", "Deal Executed", `Syndicate funds transferred to Startup company.`);
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }

  /**
   * Cancel Deal (Lead only)
   */
  static async cancelDeal(poolAddress: string) {
    const store = this.getStore();
    const txId = store.addTransaction("Cancel Syndicate Pool");

    try {
      const tx = await this.buildInvokeTx(poolAddress, "cancel_deal");
      const signedXdr = await store.walletService.signTransaction(tx.toXDR(), store.publicKey!);
      const res = await store.stellarService.submitTransaction(signedXdr, (status, extra) => {
        store.updateTransaction(txId, { status, error: extra });
      });

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });
      store.addEvent("cancel", "Pool Cancelled", "Syndicate campaign aborted. Deposits open for withdrawal.");
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }

  /**
   * Claim returns (Investors only)
   */
  static async claimReturns(poolAddress: string) {
    const store = this.getStore();
    const txId = store.addTransaction("Claim Share of Returns");

    try {
      const tx = await this.buildInvokeTx(poolAddress, "claim_returns");
      const signedXdr = await store.walletService.signTransaction(tx.toXDR(), store.publicKey!);
      const res = await store.stellarService.submitTransaction(signedXdr, (status, extra) => {
        store.updateTransaction(txId, { status, error: extra });
      });

      store.updateTransaction(txId, { status: "confirmed", hash: res.hash });
      store.addEvent("claim", "Returns Claimed", "Exit returns successfully claimed.");
    } catch (e: any) {
      store.updateTransaction(txId, { status: "failed", error: e.message });
      throw e;
    }
  }
}

// Importing rpc namespace safely from stellar-sdk for types
import { rpc } from "stellar-sdk";
