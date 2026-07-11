"use client";

import { useAppStore, TxStatus } from "@/state/useAppStore";
import { useState } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCw, 
  ExternalLink, 
  Trash2, 
  Loader2,
  Send,
  Coins,
  ArrowUpRight,
  User,
  Info,
  Wallet
} from "lucide-react";

export default function TransactionCenterPage() {
  const { 
    transactions, 
    clearTransactions, 
    network, 
    stellarService, 
    walletService, 
    publicKey, 
    isConnected, 
    connectWallet,
    addTransaction,
    updateTransaction,
    addEvent
  } = useAppStore();

  const explorerUrl = stellarService.getNetworkDetails().explorerUrl;

  // Form states
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);

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

  const handleSendXlm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !publicKey) {
      setTxError("Please connect your wallet first.");
      return;
    }

    // Basic Validation
    if (!recipient.startsWith("G") || recipient.length !== 56) {
      setTxError("Invalid Stellar recipient address. Must be a 56-character public key starting with 'G'.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setTxError("Please enter a valid positive amount of XLM.");
      return;
    }

    setSending(true);
    setTxError(null);
    setTxSuccessHash(null);

    const txId = addTransaction(`Transfer ${amount} XLM to ${recipient.slice(0, 6)}...`);

    try {
      // 1. Build payment transaction
      const tx = await stellarService.buildPaymentTx(publicKey, recipient, amount);

      // 2. Sign transaction via connected wallet
      updateTransaction(txId, { status: "pending" });
      const signedXdr = await walletService.signTransaction(tx.toXDR(), publicKey);

      // 3. Submit transaction to Stellar network
      const res = await stellarService.submitTransaction(signedXdr, (status, extra) => {
        updateTransaction(txId, { status, error: extra });
      });

      // 4. Update Success state
      updateTransaction(txId, { status: "confirmed", hash: res.hash });
      addEvent("system", "XLM Transfer Success", `Sent ${amount} XLM to ${recipient.slice(0, 6)}...`);
      setTxSuccessHash(res.hash);
      setAmount("");
      setRecipient("");
    } catch (err: any) {
      const errMsg = err.message || "Failed to complete transaction.";
      setTxError(errMsg);
      updateTransaction(txId, { status: "failed", error: errMsg });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Transaction Center</h2>
          <p className="text-sm text-muted-foreground">
            Instantly transfer native Stellar XLM assets and view ledger transaction histories.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Send XLM Panel */}
        <div className="lg:col-span-1 glass-panel rounded-2xl border border-border p-6 space-y-5 h-fit">
          <div className="flex items-center gap-3 border-b border-border/50 pb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Send size={18} className="text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Send Stellar XLM</h3>
              <p className="text-xs text-muted-foreground">Transfer native token assets on {network.toUpperCase()}</p>
            </div>
          </div>

          {!isConnected ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto text-muted-foreground">
                <Wallet size={20} />
              </div>
              <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
                Connect your Stellar wallet to authorize and send XLM transactions.
              </p>
              <button
                onClick={() => connectWallet()}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-primary/10"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendXlm} className="space-y-4">
              {/* Recipient Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <User size={12} />
                  Recipient Public Key
                </label>
                <input
                  type="text"
                  placeholder="G..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  disabled={sending}
                  required
                  className="w-full bg-secondary/20 border border-border/80 rounded-xl px-3 py-2.5 text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-all font-mono"
                />
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Coins size={12} />
                  Amount (XLM)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={sending}
                    required
                    className="w-full bg-secondary/20 border border-border/80 rounded-xl pl-3 pr-12 py-2.5 text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-all"
                  />
                  <span className="absolute right-3 top-3 text-[10px] font-bold text-muted-foreground">XLM</span>
                </div>
              </div>

              {/* Status Notifications */}
              {txError && (
                <div className="flex items-start gap-2 bg-rose-950/30 border border-rose-900/50 rounded-xl p-3 text-xs text-rose-300">
                  <XCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{txError}</span>
                </div>
              )}

              {txSuccessHash && (
                <div className="space-y-2 bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-3 text-xs text-emerald-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                    <span>Transaction successful!</span>
                  </div>
                  <div className="pt-1 border-t border-emerald-900/20 flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground font-mono">Hash: {txSuccessHash.slice(0, 8)}...</span>
                    <a
                      href={`${explorerUrl}/tx/${txSuccessHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-emerald-400 hover:underline flex items-center gap-0.5"
                    >
                      View on Explorer <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/10"
              >
                {sending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Sending XLM...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={14} />
                    <span>Transact XLM</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="flex gap-2 bg-secondary/10 border border-border/30 rounded-xl p-3 text-[10px] text-muted-foreground leading-normal">
            <Info size={14} className="shrink-0 text-primary mt-0.5" />
            <span>Always ensure you have at least 1-2 XLM remaining in your wallet to cover minimum ledger reserves and transaction base fees.</span>
          </div>
        </div>

        {/* Transaction History Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Live Session History</h3>
              <p className="text-[11px] text-muted-foreground">Transactions queued or completed in this web session</p>
            </div>
            {transactions.length > 0 && (
              <button
                onClick={clearTransactions}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-white px-2.5 py-1 border border-border rounded-lg bg-secondary/20 hover:bg-secondary transition-all"
              >
                <Trash2 size={11} />
                Clear Logs
              </button>
            )}
          </div>

          <div className="glass-panel rounded-2xl border border-border p-6 min-h-[300px]">
            {transactions.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <Clock className="mx-auto text-muted-foreground/60 animate-pulse" size={32} />
                <p className="text-xs text-muted-foreground">No transaction logs in current browser memory.</p>
                <p className="text-[10px] text-muted-foreground/60">Submitting syndications, investments, or direct transfers will log output details here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => {
                  const { icon: Icon, color, label } = getStatusStyle(tx.status);
                  return (
                    <div 
                      key={tx.id} 
                      className="glass-card rounded-xl p-4 border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/10 transition-all"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold flex items-center gap-1 ${color}`}>
                            <Icon size={10} className={tx.status === "submitting" ? "animate-spin" : ""} />
                            {label}
                          </span>
                          <h4 className="text-xs font-semibold text-white truncate max-w-[250px] md:max-w-md">{tx.name}</h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground font-mono">
                          <span>Time: {new Date(tx.timestamp).toLocaleTimeString()}</span>
                          {tx.hash && (
                            <span className="truncate">Hash: {tx.hash}</span>
                          )}
                        </div>

                        {tx.error && (
                          <div className="text-xs text-rose-300 bg-rose-950/20 border border-rose-900/50 rounded-lg p-2.5 mt-2 leading-relaxed whitespace-pre-wrap font-mono">
                            Error: {tx.error}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        {tx.hash && (
                          <a
                            href={`${explorerUrl}/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                          >
                            <span>Explorer</span>
                            <ExternalLink size={11} />
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
      </div>
    </div>
  );
}
