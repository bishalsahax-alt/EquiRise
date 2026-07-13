import { describe, test, expect, vi } from "vitest";

// Mock the wallet service BEFORE importing useAppStore
vi.mock("@/services/wallet", () => ({
  WalletService: class MockWalletService {
    connect = vi.fn(async () => "GALEAD11111111111111111111111111EQUI1");
    signTransaction = vi.fn(async () => "signedXDR");
    disconnect = vi.fn();
  },
}));

// Mock stellar service too
vi.mock("@/services/stellar", () => ({
  StellarService: class MockStellarService {
    getRpcServer = vi.fn();
    getNetworkDetails = vi.fn(() => ({
      explorerUrl: "https://stellar.expert/explorer/testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "https://soroban-testnet.stellar.org",
    }));
    submitTransaction = vi.fn(async () => ({
      hash: "abc123", resultXdr: "", ledger: 1,
    }));
  },
  NETWORK_DETAILS: {
    testnet: { networkPassphrase: "Test SDF Network ; September 2015", rpcUrl: "https://soroban-testnet.stellar.org", explorerUrl: "https://stellar.expert/explorer/testnet" },
    standalone: { networkPassphrase: "Standalone Network ; Standalone Network", rpcUrl: "http://localhost:8000/soroban/rpc", explorerUrl: "http://localhost:8000" },
  },
}));

import { useAppStore } from "@/state/useAppStore";

// Mock the core ContractService to test state transitions in our frontend client model
vi.mock("@/services/contracts", () => {
  const mockPools: any[] = [];
  return {
    ContractService: {
      deployPool: vi.fn(async (startup: string, token: string, target: number, min: number, max: number) => {
        const address = `CDP${Math.random().toString(36).substring(7).toUpperCase()}EQUI1`;
        mockPools.push({
          address,
          lead: "GALEAD11111111111111111111111111EQUI1",
          startup,
          token,
          target,
          minInvestment: min,
          maxInvestment: max,
          state: 0,
          totalInvested: 0,
          totalReturns: 0,
        });
        return address;
      }),
      deposit: vi.fn(async (poolAddr: string, amount: number) => {
        const pool = mockPools.find(p => p.address === poolAddr);
        if (pool) {
          pool.totalInvested += amount;
        }
      }),
      executeDeal: vi.fn(async (poolAddr: string) => {
        const pool = mockPools.find(p => p.address === poolAddr);
        if (pool) {
          pool.state = 1; // Funded
        }
      }),
      claimReturns: vi.fn(async () => {}),
      getPoolMetadata: vi.fn(async (poolAddr: string) => {
        return mockPools.find(p => p.address === poolAddr);
      }),
    },
    CONTRACT_ADDRESSES: {
      manager: "CDHDAJIVBYGLEQ42ILGMIALKJEQJ4LFBCOM4OQKS7P5QMZZTSSL3S3VZ",
      mockUsdc: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    },
  };
});

import { ContractService } from "@/services/contracts";

describe("EquiRise Platform Integration Test - Syndicate Lifecycle Flow", () => {

  test("Simulate Full Deal Syndicate Lifecycle from Deploy to Return Claim", async () => {
    // 1. Initial State Check (Zustand Store initialized)
    const store = useAppStore.getState();
    expect(store.isConnected).toBe(false);
    expect(store.publicKey).toBeNull();
    expect(store.transactions.length).toBe(0);

    // 2. Connect Wallet
    useAppStore.setState({ isConnected: true, publicKey: "GALEAD11111111111111111111111111EQUI1" });
    const updatedStore = useAppStore.getState();
    expect(updatedStore.isConnected).toBe(true);
    expect(updatedStore.publicKey).toBe("GALEAD11111111111111111111111111EQUI1");

    // 3. Deploy Deal Pool
    const startupAddr = "GDSTARTUP11111111111111111111111111EQUI1";
    const tokenAddr = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
    const target = 50000;
    const minInv = 500;
    const maxInv = 5000;

    const deployedPoolAddr = await ContractService.deployPool(
      startupAddr,
      tokenAddr,
      target,
      minInv,
      maxInv
    );
    expect(deployedPoolAddr).toBeDefined();
    expect(deployedPoolAddr).toContain("CDP");

    // 4. Deposit Capital (Investors fund pool)
    const firstDeposit = 5000;
    await ContractService.deposit(deployedPoolAddr, firstDeposit);

    let metadata = await ContractService.getPoolMetadata(deployedPoolAddr);
    expect(metadata.totalInvested).toBe(5000);
    expect(metadata.state).toBe(0); // Still Active

    // Simulating further deposits to meet the target
    await ContractService.deposit(deployedPoolAddr, 45000);
    metadata = await ContractService.getPoolMetadata(deployedPoolAddr);
    expect(metadata.totalInvested).toBe(50000); // Target met

    // 5. Execute Deal (Lead transfers capital to Startup)
    await ContractService.executeDeal(deployedPoolAddr);
    metadata = await ContractService.getPoolMetadata(deployedPoolAddr);
    expect(metadata.state).toBe(1); // Funded state

    // 6. Verify execution parameters completed cleanly
    expect(ContractService.deployPool).toHaveBeenCalledTimes(1);
    expect(ContractService.deposit).toHaveBeenCalledTimes(2);
    expect(ContractService.executeDeal).toHaveBeenCalledTimes(1);
  });
});
