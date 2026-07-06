import { create } from "zustand";
import { WalletService } from "@/services/wallet";
import { StellarService, NetworkType } from "@/services/stellar";
import { WalletType } from "@creit.tech/stellar-wallets-kit";

export interface TxStatus {
  id: string;
  name: string;
  status: "submitting" | "pending" | "processing" | "confirmed" | "failed";
  hash?: string;
  error?: string;
  timestamp: number;
}

export interface ActivityEvent {
  id: string;
  type: "deposit" | "execute" | "deploy" | "cancel" | "withdraw" | "claim" | "system";
  title: string;
  desc: string;
  timestamp: number;
}

interface AppState {
  publicKey: string | null;
  isConnected: boolean;
  network: NetworkType;
  transactions: TxStatus[];
  events: ActivityEvent[];
  walletService: WalletService;
  stellarService: StellarService;
  
  // Actions
  setNetwork: (network: NetworkType) => void;
  connectWallet: (walletType?: WalletType) => Promise<string>;
  disconnectWallet: () => void;
  addTransaction: (name: string) => string;
  updateTransaction: (id: string, updates: Partial<TxStatus>) => void;
  addEvent: (type: ActivityEvent["type"], title: string, desc: string) => void;
  clearTransactions: () => void;
}

export const useAppStore = create<AppState>((set, get) => {
  const initialNetwork: NetworkType = "testnet";
  const wService = new WalletService(initialNetwork);
  const sService = new StellarService(initialNetwork);

  return {
    publicKey: null,
    isConnected: false,
    network: initialNetwork,
    transactions: [],
    events: [
      {
        id: "sys-init",
        type: "system",
        title: "EquiRise Engine Initialized",
        desc: "Syndicate gateway active on Stellar Testnet.",
        timestamp: Date.now() - 3600000,
      },
    ],
    walletService: wService,
    stellarService: sService,

    setNetwork: (network: NetworkType) => {
      const walletService = new WalletService(network);
      const stellarService = new StellarService(network);
      set({ network, walletService, stellarService });
      get().addEvent("system", "Network Changed", `Switched to Stellar ${network.toUpperCase()}`);
    },

    connectWallet: async (walletType = WalletType.FREIGHTER) => {
      try {
        const address = await get().walletService.connect(walletType);
        set({ publicKey: address, isConnected: true });
        get().addEvent("system", "Wallet Connected", `Connected to wallet ${address.slice(0, 6)}...${address.slice(-6)}`);
        return address;
      } catch (err: any) {
        get().addEvent("system", "Wallet Error", err.message || "Connection failed");
        throw err;
      }
    },

    disconnectWallet: () => {
      get().walletService.disconnect();
      set({ publicKey: null, isConnected: false });
      get().addEvent("system", "Wallet Disconnected", "Secured account session ended.");
    },

    addTransaction: (name: string) => {
      const id = Math.random().toString(36).substring(7);
      set((state) => ({
        transactions: [
          {
            id,
            name,
            status: "submitting",
            timestamp: Date.now(),
          },
          ...state.transactions,
        ],
      }));
      return id;
    },

    updateTransaction: (id: string, updates: Partial<TxStatus>) => {
      set((state) => ({
        transactions: state.transactions.map((tx) =>
          tx.id === id ? { ...tx, ...updates } : tx
        ),
      }));

      // If transaction completes or fails, add it to the activity event list
      if (updates.status === "confirmed") {
        const tx = get().transactions.find((t) => t.id === id);
        get().addEvent(
          "system",
          `Success: ${tx?.name}`,
          `Tx Hash: ${updates.hash?.slice(0, 8)}... completed successfully.`
        );
      } else if (updates.status === "failed") {
        const tx = get().transactions.find((t) => t.id === id);
        get().addEvent(
          "system",
          `Failed: ${tx?.name}`,
          updates.error || "Transaction execution failed."
        );
      }
    },

    addEvent: (type, title, desc) => {
      set((state) => ({
        events: [
          {
            id: Math.random().toString(36).substring(7),
            type,
            title,
            desc,
            timestamp: Date.now(),
          },
          ...state.events,
        ],
      }));
    },

    clearTransactions: () => set({ transactions: [] }),
  };
});
