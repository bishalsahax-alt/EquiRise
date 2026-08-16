"use client";

import Logo from "@/components/Logo";
import { useAppStore } from "@/state/useAppStore";
import { Wallet, LogOut, ChevronDown, Copy, CheckCheck, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
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
      <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md px-4 sm:px-6 md:px-8 flex items-center justify-between z-30">
        {/* Page Title & Mobile Brand */}
        <div className="flex items-center gap-3">
          {pathname !== "/" && (
            <div className="md:hidden">
              <Logo size="sm" showText={false} href="/dashboard" />
            </div>
          )}
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
            {getPageTitle()}
          </h1>
        </div>

        {pathname === "/" && (
          <Logo size="sm" subtitle="GATEWAY" href="/" />
        )}

        {/* Controls */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {/* Back to Login button */}
          {pathname !== "/" && (
            <Link
              href="/"
              className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 shadow-sm"
              title="Back to Login Page"
            >
              <ArrowLeft size={13} />
              <span>Back to Login</span>
            </Link>
          )}
          {/* Network Switcher */}
          <div className="flex items-center bg-secondary/50 rounded-xl p-0.5 sm:p-1 border border-border flex-shrink-0">
            <button
              onClick={() => setNetwork("testnet")}
              className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                network === "testnet"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Testnet
            </button>
            <button
              onClick={() => setNetwork("standalone")}
              className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
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
            <div className="flex items-center gap-1.5 sm:gap-2">
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
                className="flex items-center gap-1.5 bg-secondary/50 hover:bg-secondary border border-border px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white transition-all flex-shrink-0"
                title="Switch wallet"
              >
                <Wallet size={13} />
                <ChevronDown size={12} />
              </button>

              {/* Disconnect */}
              <button
                onClick={() => disconnectWallet()}
                className="flex items-center gap-1.5 sm:gap-2 bg-secondary/50 hover:bg-red-950/40 hover:text-red-400 border border-border px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold text-muted-foreground transition-all flex-shrink-0"
                title="Disconnect"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Disconnect</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setWalletModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 px-3 py-1.5 sm:px-5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap flex-shrink-0"
            >
              <Wallet size={12} className="sm:w-3.5 sm:h-3.5" />
              <span>Connect<span className="hidden sm:inline"> Wallet</span></span>
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
