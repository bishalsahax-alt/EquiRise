import Link from "next/link";
import { ArrowRight, Coins, ShieldAlert, BarChart3, Users, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-12 relative overflow-hidden">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[70%] h-[40%] bg-primary/10 rounded-full blur-[140px] pointer-events-none animate-pulse-slow" />

      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-6 relative z-10">
        <div className="inline-flex items-center gap-2 bg-primary/15 border border-primary/20 px-4 py-1.5 rounded-full text-xs font-bold text-primary tracking-wide uppercase">
          <Zap size={12} className="animate-bounce" />
          Powered by Soroban Smart Contracts
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Launch & Back Startups via{" "}
          <span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
            On-Chain Syndicates
          </span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          EquiRise enables lead investors to instantly spin up secure capital pools, automate deal parameters, collect investor contributions, and transparently handle startup yield distributions on Stellar.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all text-sm group w-full sm:w-auto"
          >
            Launch Platform
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="https://developers.stellar.org/docs/build/smart-contracts/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-secondary/80 hover:bg-secondary text-white border border-border font-semibold px-8 py-4 rounded-xl transition-all text-sm w-full sm:w-auto"
          >
            Read Stellar Docs
          </a>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-20 relative z-10 w-full px-4">
        <div className="glass-card rounded-2xl p-6 border border-border/80 hover:border-primary/20 transition-all">
          <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit mb-4">
            <Users size={22} />
          </div>
          <h3 className="text-base font-bold text-white mb-2">Lead Deal Pools</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Approved leads can dynamically deploy a deal pool with custom targets, minimum/maximum investments, and startup wallet definitions.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border/80 hover:border-primary/20 transition-all">
          <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit mb-4">
            <Coins size={22} />
          </div>
          <h3 className="text-base font-bold text-white mb-2">Automated Distributions</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Distribute yields or exit payments proportionally back to investors. Pro-rata shares are calculated and verified by immutable smart contracts.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border/80 hover:border-primary/20 transition-all">
          <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit mb-4">
            <BarChart3 size={22} />
          </div>
          <h3 className="text-base font-bold text-white mb-2">Real-Time Insights</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Track syndicate analytics, transaction lifecycles, and event streaming feeds directly via our connected frontend interface.
          </p>
        </div>
      </div>
    </div>
  );
}
