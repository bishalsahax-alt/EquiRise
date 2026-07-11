"use client";

import { useState, useEffect } from "react";
import { X, Wallet, ExternalLink, CheckCircle2, Loader2, AlertCircle, Shield } from "lucide-react";
import { SUPPORTED_WALLETS, SupportedWalletId } from "@/services/wallet";
import { useAppStore } from "@/state/useAppStore";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connectWallet, isConnected, publicKey } = useAppStore();
  const [connectingId, setConnectingId] = useState<SupportedWalletId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Close on ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Auto-close after successful connection
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [success, onClose]);

  if (!isOpen) return null;

  const handleConnect = async (walletId: SupportedWalletId) => {
    if (connectingId) return;
    setConnectingId(walletId);
    setError(null);

    try {
      await connectWallet(walletId);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || "Failed to connect wallet.");
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Wallet size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Connect Wallet</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose your Stellar wallet to continue
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-white hover:bg-secondary/80 transition-all"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-3">
            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-800/60 rounded-xl px-4 py-3 mb-2">
                <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-center gap-2.5 bg-green-950/40 border border-green-800/60 rounded-xl px-4 py-3 mb-2">
                <CheckCircle2 size={15} className="text-green-400 shrink-0" />
                <p className="text-xs text-green-300">
                  Connected! <span className="font-mono">{publicKey?.slice(0, 8)}...{publicKey?.slice(-6)}</span>
                </p>
              </div>
            )}

            {/* Wallet options */}
            {SUPPORTED_WALLETS.map((wallet) => {
              const isConnecting = connectingId === wallet.id;
              const isDisabled = !!connectingId;

              return (
                <button
                  key={wallet.id}
                  onClick={() => handleConnect(wallet.id)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all group
                    ${isConnecting
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary/60"
                    }
                    disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-all
                    ${isConnecting ? "bg-primary/20" : "bg-secondary/80 group-hover:bg-primary/10"}`}>
                    {wallet.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{wallet.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{wallet.description}</p>
                  </div>

                  {/* Status */}
                  <div className="shrink-0">
                    {isConnecting ? (
                      <Loader2 size={18} className="text-primary animate-spin" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center group-hover:border-primary/50 transition-all">
                        <div className="w-2 h-2 rounded-full bg-border group-hover:bg-primary/50 transition-all" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Install hint */}
            <div className="pt-2 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground text-center">
                Don&apos;t have a wallet?{" "}
                <a
                  href="https://freighter.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Install Freighter <ExternalLink size={10} />
                </a>
              </p>
            </div>
          </div>

          {/* Footer security note */}
          <div className="px-6 pb-5">
            <div className="flex items-center gap-2 bg-secondary/20 rounded-lg px-3 py-2.5">
              <Shield size={12} className="text-muted-foreground shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                EquiRise never stores your private keys. All signing happens inside your wallet extension.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
