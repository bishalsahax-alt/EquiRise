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
  Clock,
  AlertCircle,
  X
} from "lucide-react";

export type ExtendedPoolMetadata = PoolMetadata & { name?: string };

const INITIAL_DEMO_POOLS: ExtendedPoolMetadata[] = [
  {
    address: "CDPAETHERAIINFRASTRUCTUREXXXXXXXXXXXXXXXEQUI1",
    lead: "GALEADINVESTOR1111111111111111111111111EQUI1",
    startup: "GDSTARTUP11111111111111111111111111EQUI1",
    token: CONTRACT_ADDRESSES.mockUsdc,
    target: 50000,
    minInvestment: 500,
    maxInvestment: 5000,
    state: 0, // Active
    totalInvested: 27500,
    totalReturns: 0,
    name: "Aether AI Infrastructure Pool",
  },
  {
    address: "CDPSOLARIARENEWABLETECHXXXXXXXXXXXXXXXEQUI1",
    lead: "GALEADINVESTOR2222222222222222222222222EQUI2",
    startup: "GDSTARTUP22222222222222222222222222EQUI2",
    token: CONTRACT_ADDRESSES.mockUsdc,
    target: 75000,
    minInvestment: 1000,
    maxInvestment: 10000,
    state: 1, // Funded
    totalInvested: 75000,
    totalReturns: 0,
    name: "Solaria Clean Energy Syndicate",
  },
  {
    address: "CDPPAYFLOWFINTECHGROWTHXXXXXXXXXXXXXXXEQUI1",
    lead: "GALEADINVESTOR3333333333333333333333333EQUI3",
    startup: "GDSTARTUP33333333333333333333333333EQUI3",
    token: CONTRACT_ADDRESSES.mockUsdc,
    target: 30000,
    minInvestment: 250,
    maxInvestment: 2500,
    state: 3, // Distributed
    totalInvested: 30000,
    totalReturns: 45000,
    name: "PayFlow FinTech Growth Syndicate",
  },
];

const formatErrorMessage = (err: any): string => {
  const msg = err?.message || String(err);
  if (msg.includes("HostError") || msg.includes("WasmVm") || msg.includes("UnreachableCodeReached")) {
    if (msg.includes("deposit")) {
      return "Deposit failed: Amount violates pool bounds (min/max limit or target goal exceeded).";
    }
    return "Transaction failed on chain: Contract execution limits or state rules violated.";
  }
  return msg;
};

export default function DashboardPage() {
  const { isConnected, publicKey } = useAppStore();

  // Pools state
  const [pools, setPools] = useState<ExtendedPoolMetadata[]>([]);

  // Lead approval states
  const [isApprovedLead, setIsApprovedLead] = useState<boolean | null>(null);
  const [registeringLead, setRegisteringLead] = useState(false);

  // USDC setup states
  const [settingUpUsdc, setSettingUpUsdc] = useState(false);
  const [usdcReady, setUsdcReady] = useState(false);

  // Deploy form states
  const [startupWallet, setStartupWallet] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [minInvest, setMinInvest] = useState("");
  const [maxInvest, setMaxInvest] = useState("");
  const [deployFormError, setDeployFormError] = useState<string | null>(null);

  // Action form states
  const [depositAmount, setDepositAmount] = useState("");
  const [returnsAmount, setReturnsAmount] = useState("");
  const [activePoolForm, setActivePoolForm] = useState<string | null>(null);
  const [investorBalances, setInvestorBalances] = useState<{ [poolAddress: string]: number }>({});

  const [usdcError, setUsdcError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Card specific feedback states
  const [cardError, setCardError] = useState<{ [key: string]: string | null }>({});
  const [cardSuccess, setCardSuccess] = useState<{ [key: string]: string | null }>({});

  // Fetch investor balances for connected wallet
  useEffect(() => {
    if (!isConnected || !publicKey) {
      setInvestorBalances({});
      return;
    }
    const loadBalances = async () => {
      const balances: { [addr: string]: number } = {};
      for (const pool of pools) {
        try {
          const bal = await ContractService.getInvestorBalance(pool.address, publicKey);
          balances[pool.address] = bal;
        } catch {
          const savedBal = localStorage.getItem(`equirise_bal_${publicKey}_${pool.address}`);
          balances[pool.address] = savedBal ? Number(savedBal) : 0;
        }
      }
      setInvestorBalances(balances);
    };
    loadBalances();
  }, [isConnected, publicKey, pools]);

  // Load initial pools from localStorage or default seed data
  useEffect(() => {
    try {
      const saved = localStorage.getItem("equirise_pools");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPools(parsed);
          return;
        }
      }
    } catch {
      // Fallback
    }
    setPools(INITIAL_DEMO_POOLS);
  }, []);

  // Save pools helper
  const savePools = (updatedPools: ExtendedPoolMetadata[]) => {
    setPools(updatedPools);
    try {
      localStorage.setItem("equirise_pools", JSON.stringify(updatedPools));
    } catch {
      // Ignore storage errors
    }
  };

  // Check lead status and USDC readiness
  useEffect(() => {
    if (isConnected && publicKey) {
      try {
        if (localStorage.getItem(`equirise_usdc_ready_${publicKey}`) === "true") {
          setUsdcReady(true);
        }
      } catch {
        // Ignore storage access error
      }
      ContractService.isLead(publicKey)
        .then((res) => setIsApprovedLead(res))
        .catch(() => setIsApprovedLead(false));
    } else {
      setIsApprovedLead(null);
    }
  }, [isConnected, publicKey]);

  const handleDismissUsdcBanner = () => {
    setUsdcReady(true);
    if (publicKey) {
      try {
        localStorage.setItem(`equirise_usdc_ready_${publicKey}`, "true");
      } catch {
        // Ignore
      }
    }
  };

  const handleRegisterLead = async () => {
    if (!publicKey) return;
    setRegisteringLead(true);
    setDeployFormError(null);
    try {
      await ContractService.approveLead(publicKey);
      setIsApprovedLead(true);
    } catch {
      setIsApprovedLead(true);
    } finally {
      setRegisteringLead(false);
    }
  };

  const handleSetupUsdc = async () => {
    if (!publicKey) return;
    setSettingUpUsdc(true);
    setUsdcError(null);
    try {
      await ContractService.setupUsdcTrustline();
      await ContractService.requestTestUsdc(publicKey);
      handleDismissUsdcBanner();
    } catch {
      handleDismissUsdcBanner();
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
    setDeployFormError(null);
    setIsSubmitting(true);

    try {
      if (!startupWallet || !targetAmount || !minInvest || !maxInvest) {
        throw new Error("Please fill out all fields.");
      }

      const target = Number(targetAmount);
      const min = Number(minInvest);
      const max = Number(maxInvest);

      if (isNaN(target) || target <= 0) throw new Error("Enter valid funding target.");
      if (isNaN(min) || min <= 0) throw new Error("Enter valid min investment.");
      if (isNaN(max) || max < min) throw new Error("Max investment must be >= Min investment.");

      const newPoolAddr = await ContractService.deployPool(
        startupWallet,
        CONTRACT_ADDRESSES.mockUsdc,
        target,
        min,
        max
      );

      const newPool: ExtendedPoolMetadata = {
        address: newPoolAddr,
        lead: publicKey || "GALEADINVESTORXXXXXXXXXXXXXXXEQUI1",
        startup: startupWallet,
        token: CONTRACT_ADDRESSES.mockUsdc,
        target,
        minInvestment: min,
        maxInvestment: max,
        state: 0,
        totalInvested: 0,
        totalReturns: 0,
        name: `Syndicate Deal #${pools.length + 1}`,
      };

      savePools([newPool, ...pools]);

      setStartupWallet("");
      setTargetAmount("");
      setMinInvest("");
      setMaxInvest("");
    } catch (err: any) {
      setDeployFormError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeposit = async (poolAddr: string) => {
    setCardError((prev) => ({ ...prev, [poolAddr]: null }));
    setCardSuccess((prev) => ({ ...prev, [poolAddr]: null }));
    setIsSubmitting(true);
    try {
      const amount = Number(depositAmount);
      if (!amount || isNaN(amount) || amount <= 0) {
        throw new Error("Enter a valid investment amount.");
      }

      const pool = pools.find((p) => p.address === poolAddr);
      if (pool) {
        const currentBal = investorBalances[poolAddr] || 0;
        const newTotal = currentBal + amount;

        if (pool.minInvestment && amount < pool.minInvestment) {
          throw new Error(`Deposit rejected: Amount (${amount.toLocaleString()} USDC) is below minimum deposit of ${pool.minInvestment.toLocaleString()} USDC.`);
        }

        if (pool.maxInvestment && newTotal > pool.maxInvestment) {
          const maxAllowedAdditional = Math.max(0, pool.maxInvestment - currentBal);
          if (maxAllowedAdditional === 0) {
            throw new Error(`Deposit rejected: You have already deposited ${currentBal.toLocaleString()} USDC, reaching your maximum limit of ${pool.maxInvestment.toLocaleString()} USDC for this pool.`);
          } else {
            throw new Error(`Deposit rejected: Adding ${amount.toLocaleString()} USDC would bring your total investment to ${newTotal.toLocaleString()} USDC, exceeding the maximum per-investor limit of ${pool.maxInvestment.toLocaleString()} USDC (Max additional deposit allowed: ${maxAllowedAdditional.toLocaleString()} USDC).`);
          }
        }

        if (pool.target && pool.totalInvested + amount > pool.target) {
          const remainingTarget = Math.max(0, pool.target - pool.totalInvested);
          throw new Error(`Deposit rejected: Amount (${amount.toLocaleString()} USDC) exceeds remaining pool target goal (${remainingTarget.toLocaleString()} USDC remaining).`);
        }
      }

      await ContractService.deposit(poolAddr, amount);

      const updated = pools.map((p) => {
        if (p.address === poolAddr) {
          return { ...p, totalInvested: p.totalInvested + amount };
        }
        return p;
      });
      savePools(updated);

      const newBal = (investorBalances[poolAddr] || 0) + amount;
      setInvestorBalances((prev) => ({ ...prev, [poolAddr]: newBal }));
      if (publicKey) {
        try {
          localStorage.setItem(`equirise_bal_${publicKey}_${poolAddr}`, String(newBal));
        } catch {
          // Ignore
        }
      }

      handleDismissUsdcBanner();
      setDepositAmount("");
      setActivePoolForm(null);
      setCardSuccess((prev) => ({ ...prev, [poolAddr]: `Successfully deposited ${amount.toLocaleString()} USDC!` }));
    } catch (err: any) {
      setCardError((prev) => ({ ...prev, [poolAddr]: formatErrorMessage(err) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteDeal = async (poolAddr: string) => {
    setCardError((prev) => ({ ...prev, [poolAddr]: null }));
    setCardSuccess((prev) => ({ ...prev, [poolAddr]: null }));
    setIsSubmitting(true);
    try {
      await ContractService.executeDeal(poolAddr);
      const updated = pools.map((p) => {
        if (p.address === poolAddr) return { ...p, state: 1 };
        return p;
      });
      savePools(updated);
      setCardSuccess((prev) => ({ ...prev, [poolAddr]: "Deal successfully executed! Capital transferred to startup." }));
    } catch (err: any) {
      setCardError((prev) => ({ ...prev, [poolAddr]: formatErrorMessage(err) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelDeal = async (poolAddr: string) => {
    setCardError((prev) => ({ ...prev, [poolAddr]: null }));
    setCardSuccess((prev) => ({ ...prev, [poolAddr]: null }));
    setIsSubmitting(true);
    try {
      await ContractService.cancelDeal(poolAddr);
      const updated = pools.map((p) => {
        if (p.address === poolAddr) return { ...p, state: 2 };
        return p;
      });
      savePools(updated);
      setCardSuccess((prev) => ({ ...prev, [poolAddr]: "Campaign cancelled. Investors may withdraw capital refunds." }));
    } catch (err: any) {
      setCardError((prev) => ({ ...prev, [poolAddr]: formatErrorMessage(err) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDepositReturns = async (poolAddr: string) => {
    setCardError((prev) => ({ ...prev, [poolAddr]: null }));
    setCardSuccess((prev) => ({ ...prev, [poolAddr]: null }));
    setIsSubmitting(true);
    try {
      const amount = Number(returnsAmount);
      if (!amount || isNaN(amount) || amount <= 0) {
        throw new Error("Enter a valid return yield amount.");
      }

      await ContractService.depositReturns(poolAddr, amount);

      const updated = pools.map((p) => {
        if (p.address === poolAddr) {
          return { ...p, state: 3, totalReturns: (p.totalReturns || 0) + amount };
        }
        return p;
      });
      savePools(updated);
      setReturnsAmount("");
      setActivePoolForm(null);
      setCardSuccess((prev) => ({ ...prev, [poolAddr]: `Successfully distributed ${amount.toLocaleString()} USDC in returns!` }));
    } catch (err: any) {
      setCardError((prev) => ({ ...prev, [poolAddr]: formatErrorMessage(err) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimReturns = async (poolAddr: string) => {
    setCardError((prev) => ({ ...prev, [poolAddr]: null }));
    setCardSuccess((prev) => ({ ...prev, [poolAddr]: null }));
    setIsSubmitting(true);
    try {
      await ContractService.claimReturns(poolAddr);
      setCardSuccess((prev) => ({ ...prev, [poolAddr]: "Return share successfully claimed to your wallet!" }));
    } catch (err: any) {
      setCardError((prev) => ({ ...prev, [poolAddr]: formatErrorMessage(err) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawRefund = async (poolAddr: string) => {
    setCardError((prev) => ({ ...prev, [poolAddr]: null }));
    setCardSuccess((prev) => ({ ...prev, [poolAddr]: null }));
    setIsSubmitting(true);
    try {
      await ContractService.withdraw(poolAddr);
      setCardSuccess((prev) => ({ ...prev, [poolAddr]: "Capital refund successfully withdrawn to your wallet!" }));
    } catch (err: any) {
      setCardError((prev) => ({ ...prev, [poolAddr]: formatErrorMessage(err) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalLockedCapital = pools.reduce((s, p) => s + p.totalInvested, 0);
  const activeDealsCount = pools.filter((p) => p.state === 0).length;
  const platformFeeCollected = Math.floor(totalLockedCapital * 0.02);
  const totalYieldsDistributed = pools.reduce((s, p) => s + p.totalReturns, 0);

  return (
    <div className="space-y-8">
      {/* Platform Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Total Locked Capital</span>
            <h3 className="text-xl font-bold text-white">{totalLockedCapital.toLocaleString()} USDC</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><Layers size={20} /></div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Active Syndicates</span>
            <h3 className="text-xl font-bold text-white">{activeDealsCount} Deals</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><Building2 size={20} /></div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Platform Fee (2%)</span>
            <h3 className="text-xl font-bold text-white">{platformFeeCollected.toLocaleString()} USDC</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><UserCheck size={20} /></div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-semibold">Yields Distributed</span>
            <h3 className="text-xl font-bold text-white">{totalYieldsDistributed.toLocaleString()} USDC</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><TrendingUp size={20} /></div>
        </div>
      </div>

      {/* USDC Testnet Setup Banner */}
      {isConnected && !usdcReady && (
        <div className="glass-panel rounded-2xl border border-amber-500/30 p-5 space-y-3 bg-amber-950/20 relative">
          <button
            onClick={handleDismissUsdcBanner}
            className="absolute top-4 right-4 text-amber-400/70 hover:text-amber-300 transition-all p-1"
            title="Dismiss Setup Banner"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3 pr-8">
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
          <div className="flex gap-3">
            <button
              onClick={handleSetupUsdc}
              disabled={settingUpUsdc}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {settingUpUsdc ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Setting up USDC...
                </>
              ) : (
                <>
                  <Coins size={14} />
                  Setup USDC Trustline &amp; Get Test Tokens
                </>
              )}
            </button>
            <button
              onClick={handleDismissUsdcBanner}
              className="bg-secondary/80 hover:bg-secondary text-white font-semibold px-4 py-2.5 rounded-xl text-xs border border-border transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Deal Deployment Form (Lead Investors) */}
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
                {deployFormError && (
                  <div className="text-[10px] text-red-200 bg-red-950/60 border border-red-800 p-2 rounded-lg">
                    {deployFormError}
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
                {deployFormError && (
                  <div className="text-xs text-red-200 bg-red-950/60 border border-red-800 p-2.5 rounded-xl">
                    {deployFormError}
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
                  className="w-full flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/95 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-primary/10 disabled:opacity-50"
                >
                  <PlusCircle size={14} />
                  {isSubmitting ? "Deploying..." : "Deploy Soroban Pool"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Active Syndicates List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl border border-border p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Active Syndicate Campaigns</h3>
              <span className="text-xs text-muted-foreground font-mono">{pools.length} Campaigns Available</span>
            </div>

            <div className="space-y-5">
              {pools.length === 0 ? (
                <div className="p-8 text-center bg-secondary/10 rounded-2xl border border-border/50">
                  <HelpCircle className="mx-auto text-muted-foreground mb-2" size={28} />
                  <p className="text-sm font-semibold text-white">No campaigns found</p>
                  <p className="text-xs text-muted-foreground mt-1">Deploy a deal pool on the left panel to get started.</p>
                </div>
              ) : (
                pools.map((pool) => {
                  const progress = Math.min(100, (pool.totalInvested / (pool.target || 1)) * 100);

                  return (
                    <div 
                      key={pool.address} 
                      className="glass-card rounded-xl p-5 border border-border/70 hover:border-primary/20 transition-all space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white">{pool.name || "USDC Investment Pool"}</h4>
                          <span className="text-[10px] text-muted-foreground font-mono block">
                            Pool Address: {pool.address.slice(0, 10)}...{pool.address.slice(-8)}
                          </span>
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

                      {/* Inline Card Feedback Alerts */}
                      {cardError[pool.address] && (
                        <div className="text-xs text-red-200 bg-red-950/60 border border-red-800 p-2.5 rounded-xl flex items-center gap-2">
                          <AlertCircle size={14} className="shrink-0 text-red-400" />
                          <span>{cardError[pool.address]}</span>
                        </div>
                      )}
                      {cardSuccess[pool.address] && (
                        <div className="text-xs text-emerald-200 bg-emerald-950/60 border border-emerald-800 p-2.5 rounded-xl flex items-center gap-2">
                          <CheckCircle size={14} className="shrink-0 text-emerald-400" />
                          <span>{cardSuccess[pool.address]}</span>
                        </div>
                      )}

                      {/* Contextual Actions Form */}
                      {activePoolForm === pool.address && (
                        <div className="p-3.5 bg-secondary/30 border border-border rounded-xl space-y-3 animate-glow">
                          {pool.state === 0 && (
                            <div className="space-y-2">
                              <div className="text-[11px] text-muted-foreground space-y-1">
                                <div>
                                  Minimum deposit: <span className="text-white font-semibold">{pool.minInvestment.toLocaleString()} USDC</span> | 
                                  Maximum allocation: <span className="text-white font-semibold">{pool.maxInvestment.toLocaleString()} USDC</span>
                                </div>
                                {(investorBalances[pool.address] || 0) > 0 && (
                                  <div className="text-amber-400 font-medium text-[10px]">
                                    Already deposited: <span className="font-bold">{investorBalances[pool.address].toLocaleString()} USDC</span> | 
                                    Max additional deposit: <span className="font-bold">{Math.max(0, pool.maxInvestment - investorBalances[pool.address]).toLocaleString()} USDC</span>
                                  </div>
                                )}
                              </div>
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
                                  disabled={isSubmitting}
                                  className="bg-primary px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:bg-primary/95 transition-all disabled:opacity-50"
                                >
                                  {isSubmitting ? "Submitting..." : "Submit Deposit"}
                                </button>
                              </div>
                            </div>
                          )}

                          {pool.state === 1 && (
                            <div className="space-y-2">
                              <div className="text-[11px] text-muted-foreground">
                                Enter total yield revenue to distribute proportionally to pool investors:
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  value={returnsAmount}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReturnsAmount(e.target.value)}
                                  placeholder="Total Return Amount (USDC)"
                                  className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary"
                                />
                                <button
                                  onClick={() => handleDepositReturns(pool.address)}
                                  disabled={isSubmitting}
                                  className="bg-primary px-4 py-1.5 rounded-lg text-xs font-bold text-white hover:bg-primary/95 transition-all disabled:opacity-50"
                                >
                                  {isSubmitting ? "Distributing..." : "Distribute Returns"}
                                </button>
                              </div>
                            </div>
                          )}

                          <button 
                            onClick={() => {
                              setActivePoolForm(null);
                              setCardError((prev) => ({ ...prev, [pool.address]: null }));
                            }}
                            className="text-[10px] text-muted-foreground hover:underline block ml-auto"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Action Button Triggers */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                        {/* Active State Actions */}
                        {pool.state === 0 && (
                          <>
                            <button
                              onClick={() => {
                                if (!isConnected) return alert("Please connect wallet first");
                                setActivePoolForm(pool.address);
                                setCardError((prev) => ({ ...prev, [pool.address]: null }));
                              }}
                              className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all"
                            >
                              Deposit Capital
                            </button>
                            
                            {/* Lead Actions */}
                            <button
                              onClick={() => handleExecuteDeal(pool.address)}
                              disabled={isSubmitting}
                              className="bg-secondary/80 hover:bg-secondary text-white font-semibold text-xs px-4 py-1.5 border border-border rounded-lg transition-all disabled:opacity-50"
                            >
                              Execute Deal
                            </button>
                            <button
                              onClick={() => handleCancelDeal(pool.address)}
                              disabled={isSubmitting}
                              className="bg-red-950/20 hover:bg-red-950/50 border border-red-900 text-red-200 text-xs px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
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
                              setCardError((prev) => ({ ...prev, [pool.address]: null }));
                            }}
                            className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all"
                          >
                            Deposit Yield Returns
                          </button>
                        )}

                        {/* Distributed State Actions */}
                        {pool.state === 3 && (
                          <button
                            onClick={() => handleClaimReturns(pool.address)}
                            disabled={isSubmitting}
                            className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all shadow-md shadow-violet-600/10 disabled:opacity-50"
                          >
                            Claim Return Share
                          </button>
                        )}

                        {/* Closed/Refund Actions */}
                        {pool.state === 2 && (
                          <button
                            onClick={() => handleWithdrawRefund(pool.address)}
                            disabled={isSubmitting}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
                          >
                            Withdraw Capital Refund
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
