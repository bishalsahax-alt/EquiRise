"use client";

import { useAppStore } from "@/state/useAppStore";
import { Wallet, LogOut, ChevronDown, Copy, CheckCheck } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import WalletModal from "./WalletModal";

export default function Navbar() {
  const {
    publicKey,
    isConnected,
    network,
    setNetwork,
    disconnectWallet,
  } = useAppStore();

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();

  const getPageTitle = () => {
    switch (pathname) {
      case "/dashboard": return "Dashboard";
      case "/activity": return "Activity Feed";
      case "/transactions": return "Transaction Center";
      case "/analytics": return "Syndicate Analytics";
      case "/settings": return "Contract & System Settings";
      default: return "EquiRise Gateway";
    }
  };

  const copyAddress = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md px-6 md:px-8 flex items-center justify-between z-30">
        {/* Page Title */}
        <h1 className="text-lg font-bold tracking-tight text-white hidden sm:block">
          {getPageTitle()}
        </h1>

        {pathname === "/" && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center font-bold text-xs text-white">E</div>
            <span className="font-extrabold text-sm text-white">EquiRise</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Network Switcher */}
          <div className="flex items-center bg-secondary/50 rounded-xl p-1 border border-border">
            <button
              onClick={() => setNetwork("testnet")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                network === "testnet"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Testnet
            </button>
            <button
              onClick={() => setNetwork("standalone")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                network === "standalone"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Standalone
            </button>
          </div>

          {/* Wallet */}
          {isConnected && publicKey ? (
            <div className="flex items-center gap-2">
              {/* Address chip */}
              <button
                onClick={copyAddress}
                className="hidden lg:flex items-center gap-2 bg-secondary/60 hover:bg-secondary border border-border rounded-xl px-3 py-2 transition-all group"
                title="Copy address"
              >
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-mono text-white">
                  {publicKey.slice(0, 6)}...{publicKey.slice(-6)}
                </span>
                {copied ? (
                  <CheckCheck size={12} className="text-green-400" />
                ) : (
                  <Copy size={12} className="text-muted-foreground group-hover:text-white transition-colors" />
                )}
              </button>

              {/* Switch wallet */}
              <button
                onClick={() => setWalletModalOpen(true)}
                className="flex items-center gap-1.5 bg-secondary/50 hover:bg-secondary border border-border px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white transition-all"
                title="Switch wallet"
              >
                <Wallet size={13} />
                <ChevronDown size={12} />
              </button>

              {/* Disconnect */}
              <button
                onClick={() => disconnectWallet()}
                className="flex items-center gap-2 bg-secondary/50 hover:bg-red-950/40 hover:text-red-400 border border-border px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground transition-all"
                title="Disconnect"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Disconnect</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setWalletModalOpen(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 px-5 py-2 rounded-xl text-xs font-bold transition-all"
            >
              <Wallet size={14} />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </header>

      {/* Multi-wallet modal */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </>
  );
}
