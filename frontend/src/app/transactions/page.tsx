"use client";

import { useAppStore, TxStatus } from "@/state/useAppStore";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCw, 
  ExternalLink, 
  Trash2, 
  Loader2 
} from "lucide-react";

export default function TransactionCenterPage() {
  const { transactions, clearTransactions, network, stellarService } = useAppStore();
  const explorerUrl = stellarService.getNetworkDetails().explorerUrl;

  const getStatusStyle = (status: TxStatus["status"]) => {
    switch (status) {
      case "confirmed":
        return {
          icon: CheckCircle2,
          color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
          label: "Confirmed",
        };
      case "failed":
        return {
          icon: XCircle,
          color: "text-rose-400 border-rose-500/20 bg-rose-500/5",
          label: "Failed",
        };
      case "submitting":
        return {
          icon: Loader2,
          color: "text-blue-400 border-blue-500/20 bg-blue-500/5 animate-spin",
          label: "Submitting",
        };
      default:
        return {
          icon: Clock,
          color: "text-amber-400 border-amber-500/20 bg-amber-500/5 animate-pulse",
          label: "Processing",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Transaction Center</h2>
          <p className="text-sm text-muted-foreground">
            Track and manage your submitted transactions.
          </p>
        </div>
        
        {transactions.length > 0 && (
          <button
            onClick={clearTransactions}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white px-3 py-1.5 border border-border rounded-xl bg-secondary/20 hover:bg-secondary transition-all"
          >
            <Trash2 size={13} />
            Clear Queue
          </button>
        )}
      </div>

      {/* Transaction List */}
      <div className="glass-panel rounded-2xl border border-border p-6">
        {transactions.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Clock className="mx-auto text-muted-foreground animate-pulse" size={32} />
            <p className="text-sm text-muted-foreground">No transactions submitted in this session.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => {
              const { icon: Icon, color, label } = getStatusStyle(tx.status);
              return (
                <div 
                  key={tx.id} 
                  className="glass-card rounded-xl p-5 border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/10 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1.5 ${color}`}>
                        <Icon size={12} className={tx.status === "submitting" ? "animate-spin" : ""} />
                        {label}
                      </span>
                      <h4 className="text-sm font-semibold text-white">{tx.name}</h4>
                    </div>

                    <p className="text-[11px] text-muted-foreground font-mono">
                      Timestamp: {new Date(tx.timestamp).toLocaleString()}
                    </p>

                    {tx.error && (
                      <p className="text-xs text-rose-300 bg-rose-950/20 border border-rose-900/50 rounded-lg p-2 mt-2 leading-relaxed">
                        Error: {tx.error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Retry on fail */}
                    {tx.status === "failed" && (
                      <button
                        onClick={() => {
                          alert("Retrying transaction is managed inside the action forms.");
                        }}
                        className="flex items-center gap-1.5 bg-secondary/80 hover:bg-secondary px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-white transition-all"
                      >
                        <RotateCw size={13} />
                        Retry
                      </button>
                    )}

                    {/* Explorer Link */}
                    {tx.hash && (
                      <a
                        href={`${explorerUrl}/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                      >
                        <span>View Explorer</span>
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
