"use client";

import { useAppStore } from "@/state/useAppStore";
import { Wallet, Globe, LogOut, Loader2, KeyRound } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { 
    publicKey, 
    isConnected, 
    network, 
    setNetwork, 
    connectWallet, 
    disconnectWallet 
  } = useAppStore();

  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  // Determine current page title
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

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectWallet();
    } catch (e: any) {
      setError(e.message || "Failed to connect wallet.");
      // Auto clear error after 4 seconds
      setTimeout(() => setError(null), 4000);
    } finally {
      setConnecting(false);
    }
  };

  return (
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

      {/* Network / Wallet Controls */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Error notification */}
        {error && (
          <div className="text-xs bg-red-950/80 border border-red-800 text-red-200 px-3 py-1.5 rounded-lg animate-pulse">
            {error}
          </div>
        )}

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

        {/* Wallet Button */}
        {isConnected && publicKey ? (
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-[11px] text-muted-foreground">Connected Address</span>
              <span className="text-xs font-mono font-medium text-white">
                {publicKey.slice(0, 6)}...{publicKey.slice(-6)}
              </span>
            </div>
            
            <button
              onClick={() => disconnectWallet()}
              className="flex items-center justify-center gap-2 bg-secondary/80 hover:bg-red-950/40 hover:text-red-400 border border-border px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {connecting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Wallet size={14} />
                <span>Connect Wallet</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
