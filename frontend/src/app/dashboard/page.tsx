"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/state/useAppStore";
import { ContractService, PoolMetadata, CONTRACT_ADDRESSES } from "@/services/contracts";
import { 
  Building2, 
  Coins, 
  Layers, 
  Rocket, 
  TrendingUp, 
  UserCheck, 
  PlusCircle, 
  CheckCircle,
  XCircle,
  HelpCircle,
  Clock
} from "lucide-react";

export default function DashboardPage() {
  const { isConnected, publicKey } = useAppStore();

  // Pools deployed on-chain. Starts empty; populated by user via Deploy form.
  const [pools, setPools] = useState<PoolMetadata[]>([]);

  // Lead approval states
  const [isApprovedLead, setIsApprovedLead] = useState<boolean | null>(null);
  const [registeringLead, setRegisteringLead] = useState(false);

  // USDC setup states
  const [settingUpUsdc, setSettingUpUsdc] = useState(false);
  const [usdcReady, setUsdcReady] = useState(false);

  // Form states
  const [startupWallet, setStartupWallet] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [minInvest, setMinInvest] = useState("");
  const [maxInvest, setMaxInvest] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [returnsAmount, setReturnsAmount] = useState("");
  const [activePoolForm, setActivePoolForm] = useState<string | null>(null);
  
  const [formError, setFormError] = useState<string | null>(null);
  const [usdcError, setUsdcError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check lead status whenever wallet connects/disconnects
  useEffect(() => {
    if (isConnected && publicKey) {
      ContractService.isLead(publicKey)
        .then((res) => setIsApprovedLead(res))
        .catch(() => setIsApprovedLead(false));
    } else {
      setIsApprovedLead(null);
    }
  }, [isConnected, publicKey]);

  const handleRegisterLead = async () => {
    if (!publicKey) return;
    setRegisteringLead(true);
    setFormError(null);
    try {
      await ContractService.approveLead(publicKey);
      setIsApprovedLead(true);
    } catch (err: any) {
      setFormError(err.message || "Failed to self-register as Lead Investor.");
    } finally {
      setRegisteringLead(false);
    }
  };

  const handleSetupUsdc = async () => {
    if (!publicKey) return;
    setSettingUpUsdc(true);
    setUsdcError(null);
    try {
      // Step 1: Establish trustline
      await ContractService.setupUsdcTrustline();
      // Step 2: Request test USDC
      await ContractService.requestTestUsdc(publicKey);
      setUsdcReady(true);
    } catch (err: any) {
      setUsdcError(err.message || "Failed to setup USDC.");
    } finally {
      setSettingUpUsdc(false);
    }
  };

  const getPoolStateBadge = (state: number) => {
    switch (state) {
      case 0:
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
            <Clock size={10} /> Active
          </span>
        );
      case 1:
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center gap-1">
            <CheckCircle size={10} /> Funded
          </span>
        );
      case 2:
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-1">
            <XCircle size={10} /> Closed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center gap-1">
            <Coins size={10} /> Distributed
          </span>
        );
    }
  };

  const handleDeployPool = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (!startupWallet || !targetAmount || !minInvest || !maxInvest) {
        throw new Error("Please fill out all fields.");
      }

      // Inter-contract call to deploy via Syndicate Manager
      const newPoolAddr = await ContractService.deployPool(
        startupWallet,
        CONTRACT_ADDRESSES.mockUsdc,
        Number(targetAmount),
        Number(minInvest),
        Number(maxInvest)
      );

      // Append new pool to state
      const newPool: PoolMetadata = {
        address: newPoolAddr,
        lead: publicKey || "GALEADINVESTORXXXXXXXXXXXXXXXEQUI1",
        startup: startupWallet,
        token: CONTRACT_ADDRESSES.mockUsdc,
        target: Number(targetAmount),
        minInvestment: Number(minInvest),
        maxInvestment: Number(maxInvest),
        state: 0,
        totalInvested: 0,
        totalReturns: 0,
      };

      setPools([newPool, ...pools]);

      // Reset form
      setStartupWallet("");
      setTargetAmount("");
      setMinInvest("");
      setMaxInvest("");
    } catch (err: any) {
      setFormError(err.message || "Failed to deploy deal pool.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeposit = async (poolAddr: string) => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const amount = Number(depositAmount);
      if (!amount || amount <= 0) throw new Error("Enter valid investment amount");

      await ContractService.deposit(poolAddr, amount);

      // Update local state balance
      setPools(pools.map((p) => {
        if (p.address === poolAddr) {
          return { ...p, totalInvested: p.totalInvested + amount };
        }
        return p;
      }));

      setDepositAmount("");
      setActivePoolForm(null);
    } catch (err: any) {
      setFormError(err.message || "Deposit failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteDeal = async (poolAddr: string) => {
    setIsSubmitting(true);
    try {
      await ContractService.executeDeal(poolAddr);
      setPools(pools.map((p) => {
        if (p.address === poolAddr) return { ...p, state: 1 };
        return p;
      }));
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelDeal = async (poolAddr: string) => {
    setIsSubmitting(true);
    try {
      await ContractService.cancelDeal(poolAddr);
      setPools(pools.map((p) => {
        if (p.address === poolAddr) return { ...p, state: 2 };
        return p;
      }));
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDepositReturns = async (poolAddr: string) => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const amount = Number(returnsAmount);
      if (!amount || amount <= 0) throw new Error("Enter valid return amount");

      // In real code, calls deposit_returns
      setPools(pools.map((p) => {
        if (p.address === poolAddr) {
          return { ...p, state: 3, totalReturns: amount };
        }
        return p;
      }));
      setReturnsAmount("");
      setActivePoolForm(null);
    } catch (err: any) {
      setFormError(err.message || "Returns deposit failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimReturns = async (poolAddr: string) => {
    setIsSubmitting(true);
    try {
      await ContractService.claimReturns(poolAddr);
      alert("Success: Returns successfully claimed and paid to your wallet.");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawRefund = async (poolAddr: string) => {
    setIsSubmitting(true);
    try {
      await ContractService.claimReturns(poolAddr); // claims/withdraws refunds in closed state
      alert("Success: Refunded capital successfully claimed.");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Platform Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Total Locked Capital</span>
            <h3 className="text-xl font-bold text-white">{pools.reduce((s, p) => s + p.totalInvested, 0).toLocaleString()} USDC</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><Layers size={20} /></div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Active Syndicates</span>
            <h3 className="text-xl font-bold text-white">
              {pools.filter((p) => p.state === 0).length} Deals
            </h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><Building2 size={20} /></div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Platform Fee Collected</span>
            <h3 className="text-xl font-bold text-white">{Math.floor(pools.reduce((s, p) => s + p.totalInvested, 0) * 0.02).toLocaleString()} USDC</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><UserCheck size={20} /></div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Yields Distributed</span>
            <h3 className="text-xl font-bold text-white">{pools.reduce((s, p) => s + p.totalReturns, 0).toLocaleString()} USDC</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><TrendingUp size={20} /></div>
        </div>
      </div>

      {/* USDC Testnet Setup Banner */}
      {isConnected && !usdcReady && (
        <div className="glass-panel rounded-2xl border border-amber-500/30 p-5 space-y-3 bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
              <Coins size={20} />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-white">Setup USDC for Testnet</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Before you can deposit into deal pools, your wallet needs a USDC trustline and test tokens.
                This is a one-time setup for the Stellar testnet.
              </p>
            </div>
          </div>
          {usdcError && (
            <div className="text-[10px] text-red-200 bg-red-950/60 border border-red-800 p-2 rounded-lg">
              {usdcError}
            </div>
          )}
          <button
            onClick={handleSetupUsdc}
            disabled={settingUpUsdc}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {settingUpUsdc ? (
              <>
                <span className="animate-spin">⏳</span>
                Setting up USDC (sign the wallet prompt)...
              </>
            ) : (
              <>
                <Coins size={14} />
                Setup USDC Trustline &amp; Get Test Tokens
              </>
            )}
          </button>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Deal Deployment Form (Lead Investors Only) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl border border-border p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Rocket className="text-primary" size={18} />
                Deploy Deal Pool
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dynamic deployment of Deal pools via Factory contract.
              </p>
            </div>

            {!isConnected ? (
              <div className="p-4 bg-secondary/20 border border-border rounded-xl text-center">
                <HelpCircle className="mx-auto text-muted-foreground animate-bounce mb-2" size={24} />
                <p className="text-xs text-muted-foreground">Connect wallet to unlock Lead deployment tools.</p>
              </div>
            ) : isApprovedLead === false ? (
              <div className="p-4 bg-secondary/20 border border-border rounded-xl text-center space-y-3">
                <HelpCircle className="mx-auto text-primary animate-pulse mb-1" size={24} />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white">Wallet Not Approved</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This wallet is not yet registered as a Lead Investor on the Syndicate Manager contract.
                  </p>
                </div>
                {formError && (
                  <div className="text-[10px] text-red-200 bg-red-950/60 border border-red-800 p-2 rounded-lg">
                    {formError}
                  </div>
                )}
                <button
                  onClick={handleRegisterLead}
                  disabled={registeringLead}
                  className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2 rounded-xl text-xs transition-all disabled:opacity-60"
                >
                  {registeringLead ? "Registering on Testnet..." : "Self-Approve as Lead (Demo)"}
                </button>
              </div>
            ) : isApprovedLead === null ? (
              <div className="p-4 bg-secondary/20 border border-border rounded-xl text-center">
                <p className="text-xs text-muted-foreground animate-pulse">Checking lead investor status...</p>
              </div>
            ) : (
              <form onSubmit={handleDeployPool} className="space-y-3.5">
                {formError && (
                  <div className="text-xs text-red-200 bg-red-950/60 border border-red-800 p-2.5 rounded-xl">
                    {formError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Startup Wallet Key</label>
                  <input
                    type="text"
                    required
                    value={startupWallet}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartupWallet(e.target.value)}
                    placeholder="GD..."
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-muted-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Funding Target (USDC)</label>
                  <input
                    type="number"
                    required
                    value={targetAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-white placeholder-muted-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Min Invest</label>
                    <input
                      type="number"
                      required
                      value={minInvest}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinInvest(e.target.value)}
                      placeholder="100"
                      className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-white placeholder-muted-foreground outline-none focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Max Invest</label>
                    <input
                      type="number"
                      required
                      value={maxInvest}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxInvest(e.target.value)}
                      placeholder="5000"
                      className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-xs text-white placeholder-muted-foreground outline-none focus:border-primary transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/95 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-primary/10"
                >
                  <PlusCircle size={14} />
                  Deploy Soroban Pool
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Active Syndicates list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl border border-border p-6 space-y-5">
            <h3 className="text-base font-bold text-white">Active Syndicate Campaigns</h3>

            <div className="space-y-5">
              {pools.map((pool) => {
                const progress = Math.min(100, (pool.totalInvested / pool.target) * 100);
                const isPoolLead = publicKey && pool.lead.toLowerCase() === publicKey.toLowerCase();

                return (
                  <div 
                    key={pool.address} 
                    className="glass-card rounded-xl p-5 border border-border/70 hover:border-primary/10 transition-all space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Pool Address: {pool.address.slice(0, 8)}...{pool.address.slice(-6)}
                        </span>
                        <h4 className="text-sm font-bold text-white">USDC Investment Pool</h4>
                      </div>
                      {getPoolStateBadge(pool.state)}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Capital Raised</span>
                        <span className="font-semibold text-white">
                          {pool.totalInvested.toLocaleString()} / {pool.target.toLocaleString()} USDC ({progress.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-orange-400 transition-all" 
                          style={{ width: `${progress}%` }} 
                        />
                      </div>
                    </div>

                    {/* Contextual Actions Form */}
                    {activePoolForm === pool.address && (
                      <div className="p-3 bg-secondary/30 border border-border rounded-xl space-y-3 animate-glow">
                        {pool.state === 0 && (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={depositAmount}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDepositAmount(e.target.value)}
                              placeholder="USDC Amount"
                              className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary"
                            />
                            <button
                              onClick={() => handleDeposit(pool.address)}
                              className="bg-primary px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:bg-primary/95 transition-all"
                            >
                              Submit Deposit
                            </button>
                          </div>
                        )}

                        {pool.state === 1 && (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={returnsAmount}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReturnsAmount(e.target.value)}
                              placeholder="Total Return Amount"
                              className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary"
                            />
                            <button
                              onClick={() => handleDepositReturns(pool.address)}
                              className="bg-primary px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:bg-primary/95 transition-all"
                            >
                              Distribute Returns
                            </button>
                          </div>
                        )}

                        <button 
                          onClick={() => setActivePoolForm(null)}
                          className="text-[10px] text-muted-foreground hover:underline block ml-auto"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Action buttons triggers */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                      {/* Active State Actions */}
                      {pool.state === 0 && (
                        <>
                          <button
                            onClick={() => {
                              if (!isConnected) return alert("Please connect wallet first");
                              setActivePoolForm(pool.address);
                            }}
                            className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all"
                          >
                            Deposit Capital
                          </button>
                          
                          {/* Lead Actions */}
                          <button
                            onClick={() => handleExecuteDeal(pool.address)}
                            className="bg-secondary/80 hover:bg-secondary text-white font-semibold text-xs px-4 py-1.5 border border-border rounded-lg transition-all"
                          >
                            Execute Deal (Lead Only)
                          </button>
                          <button
                            onClick={() => handleCancelDeal(pool.address)}
                            className="bg-red-950/20 hover:bg-red-950/50 border border-red-900 text-red-200 text-xs px-4 py-1.5 rounded-lg transition-all"
                          >
                            Cancel Campaign
                          </button>
                        </>
                      )}

                      {/* Funded State Actions */}
                      {pool.state === 1 && (
                        <button
                          onClick={() => {
                            if (!isConnected) return alert("Please connect wallet first");
                            setActivePoolForm(pool.address);
                          }}
                          className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all"
                        >
                          Deposit Yield Returns (Lead/Startup Only)
                        </button>
                      )}

                      {/* Distributed State Actions */}
                      {pool.state === 3 && (
                        <button
                          onClick={() => handleClaimReturns(pool.address)}
                          className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all shadow-md shadow-violet-600/10"
                        >
                          Claim Return Share
                        </button>
                      )}

                      {/* Closed/Refund Actions */}
                      {pool.state === 2 && (
                        <button
                          onClick={() => handleWithdrawRefund(pool.address)}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all"
                        >
                          Withdraw Capital Refund
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
// End of DashboardPage
