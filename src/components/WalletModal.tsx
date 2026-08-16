/**
 * WalletModal — Root Wallet Connection UI Component
 * Integrates @creit.tech/stellar-wallets-kit (Freighter & xBull).
 */

import React, { useState } from "react";
import { SUPPORTED_WALLETS, SupportedWalletId, WalletService } from "../services/wallet";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (address: string) => void;
}

export function WalletModal({ isOpen, onClose, onConnected }: WalletModalProps) {
  const [connectingId, setConnectingId] = useState<SupportedWalletId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletService] = useState(() => new WalletService("testnet"));

  if (!isOpen) return null;

  const handleConnect = async (walletId: SupportedWalletId) => {
    setConnectingId(walletId);
    setError(null);
    try {
      const address = await walletService.connect(walletId);
      onConnected?.(address);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet.");
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <h3 className="text-lg font-bold">Connect Stellar Wallet</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 text-red-300 rounded-xl text-xs">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {SUPPORTED_WALLETS.map((w) => (
            <button
              key={w.id}
              onClick={() => handleConnect(w.id)}
              disabled={!!connectingId}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{w.icon}</span>
                <div>
                  <div className="font-semibold text-sm">{w.name}</div>
                  <div className="text-xs text-slate-400">{w.description}</div>
                </div>
              </div>
              <span className="text-xs font-mono text-amber-500">
                {connectingId === w.id ? "Connecting..." : "Select"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WalletModal;
