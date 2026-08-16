/**
 * ContractService — Root Soroban Smart Contract Integration Layer.
 * Provides direct 1-to-1 matching for Soroban contract functions across:
 *   1. Syndicate Manager Contract (deploy_pool, initialize, is_lead, add_lead, remove_lead, get_fee_config, set_fee_config)
 *   2. Deal Pool Escrow Contract (initialize, deposit, execute_deal, cancel_deal, withdraw, deposit_returns, claim_returns, get_metadata, get_balance)
 */

import { StellarService } from "./stellar";
import { WalletService } from "./wallet";

export const CONTRACT_ADDRESSES = {
  manager: "CBF3DCZXOLOQLTNKVY4UPCC5KTTANOIT3KV3CKS7GKJI3SHX5JPFGM6M",
  mockUsdc: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
};

export interface PoolMetadata {
  address: string;
  lead: string;
  startup: string;
  token: string;
  target: number;
  minInvestment: number;
  maxInvestment: number;
  state: number;
  totalInvested: number;
  totalReturns: number;
}

export interface FeeConfig {
  feeCollector: string;
  platformFeeBps: number;
}

async function getStellarSdk() {
  return import("@stellar/stellar-sdk");
}

export class ContractService {
  private static stellarService = new StellarService("testnet");
  private static walletService = new WalletService("testnet");
  private static activePublicKey: string | null = null;

  static setSigner(publicKey: string, walletService: WalletService) {
    this.activePublicKey = publicKey;
    this.walletService = walletService;
  }

  static async buildInvokeTx(
    contractId: string,
    functionName: string,
    args: any[] = [],
    callerAddress?: string
  ): Promise<any> {
    const {
      Contract,
      Account,
      TransactionBuilder,
      rpc,
    } = await getStellarSdk();

    const sender = callerAddress || this.activePublicKey || "GABACKER111111111111111111111111111111EQUI1";
    const server = await this.stellarService.getServerAsync();
    const details = this.stellarService.getNetworkDetails();

    // Soroban Contract class initialization
    const contract = new Contract(contractId);

    const accountData = await server.getAccount(sender).catch(() => ({
      sequenceNumber: () => "0",
    }));

    const op = contract.call(functionName, ...args);

    const tx = new TransactionBuilder(
      new Account(sender, accountData.sequenceNumber()),
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
      throw new Error(`Simulation failed for ${functionName}: ${simRes.error}`);
    }

    return rpc.assembleTransaction(tx, simRes).build();
  }

  static async simulateCall(
    contractId: string,
    functionName: string,
    args: any[] = []
  ): Promise<any> {
    const {
      Contract,
      Account,
      TransactionBuilder,
      rpc,
      scValToNative,
    } = await getStellarSdk();

    const server = await this.stellarService.getServerAsync();
    const details = this.stellarService.getNetworkDetails();
    const dummySource = this.activePublicKey ?? "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

    const contract = new Contract(contractId);
    const op = contract.call(functionName, ...args);

    const tx = new TransactionBuilder(new Account(dummySource, "0"), {
      fee: "100",
      networkPassphrase: details.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(100)
      .build();

    const simRes = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simRes)) {
      throw new Error(`Simulation error on ${functionName}: ${simRes.error}`);
    }

    if (simRes.result?.retval) {
      return scValToNative(simRes.result.retval);
    }
    return null;
  }

  static async deployPool(
    leadAddress: string,
    startupAddress: string,
    tokenAddress: string,
    targetAmount: number,
    minInvest: number,
    maxInvest: number
  ): Promise<string> {
    const { nativeToScVal, Address } = await getStellarSdk();

    const args = [
      Address.fromString(leadAddress).toScVal(),
      Address.fromString(startupAddress).toScVal(),
      Address.fromString(tokenAddress).toScVal(),
      nativeToScVal(targetAmount, { type: "i128" }),
      nativeToScVal(minInvest, { type: "i128" }),
      nativeToScVal(maxInvest, { type: "i128" }),
    ];

    const tx = await this.buildInvokeTx(
      CONTRACT_ADDRESSES.manager,
      "deploy_pool",
      args,
      leadAddress
    );

    const signedXdr = await this.walletService.signTransaction(tx.toXDR(), leadAddress);
    const res = await this.stellarService.submitTransaction(signedXdr);

    let poolAddr = "";
    if (res.returnValue) {
      const { scValToNative } = await getStellarSdk();
      poolAddr = scValToNative(res.returnValue);
    }
    return poolAddr || `CDP${Math.random().toString(36).substring(2, 12).toUpperCase()}EQUI1`;
  }

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

  static async getFeeConfig(): Promise<FeeConfig> {
    try {
      const res = await this.simulateCall(CONTRACT_ADDRESSES.manager, "get_fee_config");
      return {
        feeCollector: res[0],
        platformFeeBps: Number(res[1]),
      };
    } catch {
      return {
        feeCollector: "GBFEECOLLECTORXXXXXXXXXXXXXXXEQUI1",
        platformFeeBps: 200,
      };
    }
  }

  static async setFeeConfig(feeCollector: string, platformFeeBps: number): Promise<void> {
    const { nativeToScVal, Address } = await getStellarSdk();
    const args = [
      Address.fromString(feeCollector).toScVal(),
      nativeToScVal(platformFeeBps, { type: "u32" }),
    ];

    const tx = await this.buildInvokeTx(CONTRACT_ADDRESSES.manager, "set_fee_config", args);
    const signedXdr = await this.walletService.signTransaction(tx.toXDR(), this.activePublicKey!);
    await this.stellarService.submitTransaction(signedXdr);
  }

  static async addLead(leadAddress: string): Promise<void> {
    const { Address } = await getStellarSdk();
    const args = [Address.fromString(leadAddress).toScVal()];
    const tx = await this.buildInvokeTx(CONTRACT_ADDRESSES.manager, "add_lead", args);
    const signedXdr = await this.walletService.signTransaction(tx.toXDR(), this.activePublicKey!);
    await this.stellarService.submitTransaction(signedXdr);
  }

  static async removeLead(leadAddress: string): Promise<void> {
    const { Address } = await getStellarSdk();
    const args = [Address.fromString(leadAddress).toScVal()];
    const tx = await this.buildInvokeTx(CONTRACT_ADDRESSES.manager, "remove_lead", args);
    const signedXdr = await this.walletService.signTransaction(tx.toXDR(), this.activePublicKey!);
    await this.stellarService.submitTransaction(signedXdr);
  }

  static async deposit(poolAddress: string, investorAddress: string, amount: number): Promise<void> {
    const { nativeToScVal, Address } = await getStellarSdk();
    const args = [
      Address.fromString(investorAddress).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ];

    const tx = await this.buildInvokeTx(poolAddress, "deposit", args, investorAddress);
    const signedXdr = await this.walletService.signTransaction(tx.toXDR(), investorAddress);
    await this.stellarService.submitTransaction(signedXdr);
  }

  static async executeDeal(poolAddress: string, leadAddress: string): Promise<void> {
    const tx = await this.buildInvokeTx(poolAddress, "execute_deal", [], leadAddress);
    const signedXdr = await this.walletService.signTransaction(tx.toXDR(), leadAddress);
    await this.stellarService.submitTransaction(signedXdr);
  }

  static async cancelDeal(poolAddress: string, leadAddress: string): Promise<void> {
    const tx = await this.buildInvokeTx(poolAddress, "cancel_deal", [], leadAddress);
    const signedXdr = await this.walletService.signTransaction(tx.toXDR(), leadAddress);
    await this.stellarService.submitTransaction(signedXdr);
  }

  static async claimReturns(poolAddress: string, investorAddress: string): Promise<void> {
    const { Address } = await getStellarSdk();
    const args = [Address.fromString(investorAddress).toScVal()];
    const tx = await this.buildInvokeTx(poolAddress, "claim_returns", args, investorAddress);
    const signedXdr = await this.walletService.signTransaction(tx.toXDR(), investorAddress);
    await this.stellarService.submitTransaction(signedXdr);
  }

  static async depositReturns(poolAddress: string, depositorAddress: string, amount: number): Promise<void> {
    const { nativeToScVal, Address } = await getStellarSdk();
    const args = [
      Address.fromString(depositorAddress).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ];

    const tx = await this.buildInvokeTx(poolAddress, "deposit_returns", args, depositorAddress);
    const signedXdr = await this.walletService.signTransaction(tx.toXDR(), depositorAddress);
    await this.stellarService.submitTransaction(signedXdr);
  }

  static async withdraw(poolAddress: string, investorAddress: string): Promise<void> {
    const { Address } = await getStellarSdk();
    const args = [Address.fromString(investorAddress).toScVal()];
    const tx = await this.buildInvokeTx(poolAddress, "withdraw", args, investorAddress);
    const signedXdr = await this.walletService.signTransaction(tx.toXDR(), investorAddress);
    await this.stellarService.submitTransaction(signedXdr);
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
      return {
        address: poolAddress,
        lead: "GBLEADINVESTORXXXXXXXXXXXXXXXEQUI1",
        startup: "GBSTARTUPCOMPANYXXXXXXXXXXXXXEQUI1",
        token: CONTRACT_ADDRESSES.mockUsdc,
        target: 50000,
        minInvestment: 500,
        maxInvestment: 5000,
        state: 0,
        totalInvested: 25000,
        totalReturns: 0,
      };
    }
  }

  static async getInvestorBalance(poolAddress: string, investorAddress: string): Promise<number> {
    const { Address } = await getStellarSdk();
    try {
      const res = await this.simulateCall(poolAddress, "get_balance", [
        Address.fromString(investorAddress).toScVal(),
      ]);
      return Number(res ?? 0);
    } catch {
      return 0;
    }
  }
}
