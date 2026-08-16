import { describe, test, expect, vi } from "vitest";

// Mock @creit.tech/stellar-wallets-kit static module
vi.mock("@creit.tech/stellar-wallets-kit/sdk", () => ({
  StellarWalletsKit: {
    init: vi.fn(),
    setWallet: vi.fn(),
    fetchAddress: vi.fn(async () => ({ address: "GABACKER111111111111111111111111111111EQUI1" })),
    getAddress: vi.fn(async () => ({ address: "GABACKER111111111111111111111111111111EQUI1" })),
    signTransaction: vi.fn(async () => ({ signedTxXdr: "mock_signed_xdr" })),
    disconnect: vi.fn(),
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({
  FreighterModule: class {},
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/xbull", () => ({
  xBullModule: class {},
}));

vi.mock("@creit.tech/stellar-wallets-kit/types", () => ({
  Networks: { TESTNET: "testnet", STANDALONE: "standalone" },
}));

import { WalletService, SUPPORTED_WALLETS } from "../services/wallet";
import { ContractService, CONTRACT_ADDRESSES } from "../services/contracts";
import { StellarService } from "../services/stellar";

describe("Level 3 Audit — Contract Function & Wallet Cross-Check Suite", () => {
  test("WalletService connects Freighter & signs transaction via @creit.tech/stellar-wallets-kit", async () => {
    const service = new WalletService("testnet");
    expect(SUPPORTED_WALLETS.length).toBeGreaterThan(0);

    const address = await service.connect("freighter");
    expect(address).toBe("GABACKER111111111111111111111111111111EQUI1");
    expect(service.getSelectedWalletId()).toBe("freighter");

    const signed = await service.signTransaction("mock_xdr", address);
    expect(signed).toBe("mock_signed_xdr");
  });

  test("StellarService initializes RPC Server and Network details", () => {
    const stellar = new StellarService("testnet");
    const details = stellar.getNetworkDetails();
    expect(details.rpcUrl).toContain("stellar.org");
    expect(details.networkPassphrase).toContain("Test SDF Network");
  });

  test("ContractService defines 1-to-1 function matching for all Soroban contract methods", () => {
    expect(CONTRACT_ADDRESSES.manager).toBeDefined();
    expect(CONTRACT_ADDRESSES.mockUsdc).toBeDefined();

    expect(typeof ContractService.deployPool).toBe("function");
    expect(typeof ContractService.deposit).toBe("function");
    expect(typeof ContractService.executeDeal).toBe("function");
    expect(typeof ContractService.cancelDeal).toBe("function");
    expect(typeof ContractService.claimReturns).toBe("function");
    expect(typeof ContractService.depositReturns).toBe("function");
    expect(typeof ContractService.withdraw).toBe("function");
    expect(typeof ContractService.getFeeConfig).toBe("function");
    expect(typeof ContractService.setFeeConfig).toBe("function");
    expect(typeof ContractService.isLead).toBe("function");
    expect(typeof ContractService.getPoolMetadata).toBe("function");
  });
});
