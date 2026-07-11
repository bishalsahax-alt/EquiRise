import React from "react";
import { describe, test, expect, vi } from "vitest";

// Mock the services before importing components
vi.mock("@/services/wallet", () => ({
  WalletService: class MockWalletService {
    connect = vi.fn(async () => "GABACKER111111111111111111111111111111EQUI1");
    signTransaction = vi.fn(async () => "signedXDR");
    disconnect = vi.fn();
    getSelectedWalletId = vi.fn(() => null);
  },
  SUPPORTED_WALLETS: [],
}));

vi.mock("@/services/stellar", () => ({
  StellarService: class MockStellarService {
    getServerAsync = vi.fn();
    getRpcServer = vi.fn();
    getNetworkDetails = vi.fn(() => ({
      explorerUrl: "https://stellar.expert/explorer/testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "https://soroban-testnet.stellar.org",
    }));
    submitTransaction = vi.fn(async () => ({
      hash: "abc123", resultXdr: "", ledger: 1,
    }));
    buildPaymentTx = vi.fn(async () => ({
      toXDR: () => "mock_xdr"
    }));
  },
  NETWORK_DETAILS: {
    testnet: { networkPassphrase: "Test SDF Network ; September 2015", rpcUrl: "https://soroban-testnet.stellar.org", explorerUrl: "https://stellar.expert/explorer/testnet" },
    standalone: { networkPassphrase: "Standalone Network ; Standalone Network", rpcUrl: "http://localhost:8000/soroban/rpc", explorerUrl: "http://localhost:8000" },
  },
}));

import { render, screen } from "@testing-library/react";
import LandingPage from "../app/page";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// Mock Zustand App Store state
vi.mock("../state/useAppStore", () => {
  return {
    useAppStore: (selector?: any) => {
      const state = {
        publicKey: "GABACKER111111111111111111111111111111EQUI1",
        isConnected: true,
        network: "testnet",
        transactions: [],
        events: [],
        stellarService: {
          getNetworkDetails: () => ({
            explorerUrl: "https://stellar.expert/explorer/testnet",
          }),
        },
        connectWallet: vi.fn(),
        disconnectWallet: vi.fn(),
        setNetwork: vi.fn(),
      };
      return selector ? selector(state) : state;
    },
  };
});

describe("EquiRise Frontend - Unit Tests", () => {
  
  test("LandingPage renders hero text and CTA launch button", () => {
    render(<LandingPage />);
    
    // Check main title
    const heroTitle = screen.getByText(/Launch & Back Startups/i);
    expect(heroTitle).toBeInTheDocument();

    // Check CTA button
    const ctaButton = screen.getByRole("link", { name: /Launch Platform/i });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton.getAttribute("href")).toBe("/dashboard");
  });

  test("Navbar renders connected wallet address representation", () => {
    render(<Navbar />);

    // Verify truncated public key address representation is visible
    const keyAbbreviation = screen.getByText(/GABACK/i);
    expect(keyAbbreviation).toBeInTheDocument();

    // Disconnect button should be shown
    const disconnectBtn = screen.getByRole("button", { name: /Disconnect/i });
    expect(disconnectBtn).toBeInTheDocument();
  });

  test("Sidebar renders correct navigation items in inner pages", () => {
    render(<Sidebar />);

    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    const activityLink = screen.getByRole("link", { name: /Activity Feed/i });
    const transactionsLink = screen.getByRole("link", { name: /Transactions/i });

    expect(dashboardLink).toBeInTheDocument();
    expect(activityLink).toBeInTheDocument();
    expect(transactionsLink).toBeInTheDocument();
  });

});
