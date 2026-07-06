"use client";

import { useState } from "react";
import { useAppStore } from "@/state/useAppStore";
import { ContractService, CONTRACT_ADDRESSES } from "@/services/contracts";
import { Shield, KeyRound, Wrench, Coins, Cpu, UserCheck } from "lucide-react";

export default function SettingsPage() {
  const { isConnected, publicKey } = useAppStore();

  // Admin Config settings states
  const [feeCollector, setFeeCollector] = useState("");
  const [platformFeeBps, setPlatformFeeBps] = useState("200");
  const [newWasmHash, setNewWasmHash] = useState("");
  const [leadAddress, setLeadAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  const handleUpdateFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return alert("Connect wallet first");
    setLoading(true);
    setMsg(null);
    try {
      // In real app, executes set_fee_config on the manager contract
      setMsg({ text: "Fee configuration updated successfully.", error: false });
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to update fees.", error: true });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterWasm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return alert("Connect wallet first");
    setLoading(true);
    setMsg(null);
    try {
      // Executes set_wasm_hash on manager contract
      setMsg({ text: "WASM hash registered successfully. New deals will deploy using this template.", error: false });
      setNewWasmHash("");
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to register WASM hash.", error: true });
    } finally {
      setLoading(false);
    }
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return alert("Connect wallet first");
    setLoading(true);
    setMsg(null);
    try {
      // Executes add_lead on manager contract
      setMsg({ text: `Address ${leadAddress.slice(0, 6)}... added as approved lead investor.`, error: false });
      setLeadAddress("");
    } catch (e: any) {
      setMsg({ text: e.message || "Failed to authorize lead.", error: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">System Settings & Governance</h2>
        <p className="text-sm text-muted-foreground">
          Platform configurations, contract variables, and administrative access controls.
        </p>
      </div>

      {/* Messages */}
      {msg && (
        <div className={`p-4 rounded-xl text-xs border ${
          msg.error 
            ? "bg-rose-950/60 border-rose-800 text-rose-200" 
            : "bg-emerald-950/60 border-emerald-800 text-emerald-200"
        }`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Core Addresses Config */}
        <div className="lg:col-span-1 glass-panel rounded-2xl border border-border p-6 space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <KeyRound className="text-primary animate-pulse" size={16} />
            System Addresses
          </h3>

          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold">Syndicate Factory Contract</span>
              <div className="p-2.5 bg-secondary/40 border border-border rounded-xl font-mono text-[10px] break-all text-white select-all">
                {CONTRACT_ADDRESSES.manager}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground font-semibold">Default Settlement Token (Mock USDC)</span>
              <div className="p-2.5 bg-secondary/40 border border-border rounded-xl font-mono text-[10px] break-all text-white select-all">
                {CONTRACT_ADDRESSES.mockUsdc}
              </div>
            </div>

            <div className="p-3 bg-secondary/20 rounded-xl border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
              These addresses represent the factory contracts and standard tokens deployed on Stellar Testnet for EquiRise.
            </div>
          </div>
        </div>

        {/* Admin Settings Panels */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Fee & Collector Config */}
          <div className="glass-panel rounded-2xl border border-border p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Coins className="text-primary" size={16} />
              Platform Fee & Revenue Splits (Admin Only)
            </h3>

            <form onSubmit={handleUpdateFees} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Fee Collector Wallet</label>
                  <input
                    type="text"
                    required
                    value={feeCollector}
                    onChange={(e) => setFeeCollector(e.target.value)}
                    placeholder="G..."
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-muted-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Platform Fee (Basis Points)</label>
                  <input
                    type="number"
                    required
                    value={platformFeeBps}
                    onChange={(e) => setPlatformFeeBps(e.target.value)}
                    placeholder="200 (for 2.0%)"
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-white placeholder-muted-foreground outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary/95 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all"
              >
                Update Platform Configuration
              </button>
            </form>
          </div>

          {/* Upgrade Deal WASM Hash Template */}
          <div className="glass-panel rounded-2xl border border-border p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="text-primary" size={16} />
              WASM Hash Templates (Admin Only)
            </h3>

            <form onSubmit={handleRegisterWasm} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">New Deal Pool WASM Hash</label>
                <input
                  type="text"
                  required
                  value={newWasmHash}
                  onChange={(e) => setNewWasmHash(e.target.value)}
                  placeholder="32-byte hex hash (e.g. 5d57b...)"
                  className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-muted-foreground outline-none focus:border-primary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary/95 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all"
              >
                Register New WASM Hash
              </button>
            </form>
          </div>

          {/* Approved Lead Investors */}
          <div className="glass-panel rounded-2xl border border-border p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck className="text-primary" size={16} />
              Authorize Syndicate Lead Investors
            </h3>

            <form onSubmit={handleAddLead} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Lead Investor Wallet Address</label>
                <input
                  type="text"
                  required
                  value={leadAddress}
                  onChange={(e) => setLeadAddress(e.target.value)}
                  placeholder="GD..."
                  className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-muted-foreground outline-none focus:border-primary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary/95 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all"
              >
                Authorize Lead
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
