"use client";

import { useAppStore, ActivityEvent } from "@/state/useAppStore";
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Settings, 
  Coins, 
  PlusCircle, 
  XCircle, 
  CheckCircle2, 
  Network 
} from "lucide-react";
import { useEffect } from "react";
import { EventSubscriber } from "@/services/events";

export default function ActivityFeedPage() {
  const { events } = useAppStore();

  // Initialize event subscription when page mounts
  useEffect(() => {
    EventSubscriber.start();
    return () => EventSubscriber.stop();
  }, []);

  const getEventStyle = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "deposit":
        return {
          icon: ArrowDownLeft,
          bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
        };
      case "execute":
        return {
          icon: CheckCircle2,
          bg: "bg-orange-500/10 border-orange-500/20 text-orange-400",
        };
      case "deploy":
        return {
          icon: PlusCircle,
          bg: "bg-blue-500/10 border-blue-500/20 text-blue-400",
        };
      case "cancel":
        return {
          icon: XCircle,
          bg: "bg-rose-500/10 border-rose-500/20 text-rose-400",
        };
      case "withdraw":
        return {
          icon: ArrowUpRight,
          bg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
        };
      case "claim":
        return {
          icon: Coins,
          bg: "bg-violet-500/10 border-violet-500/20 text-violet-400",
        };
      default:
        return {
          icon: Network,
          bg: "bg-gray-500/10 border-gray-500/20 text-gray-400",
        };
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "Just now";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Live Activity Feed</h2>
          <p className="text-sm text-muted-foreground">
            Real-time ledger events streamed from registered EquiRise Syndicate contracts.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
            Connected Live
          </span>
        </div>
      </div>

      {/* Events Container */}
      <div className="glass-panel rounded-2xl border border-border p-6 space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Network className="mx-auto text-muted-foreground animate-pulse" size={32} />
            <p className="text-sm text-muted-foreground">Listening for Soroban smart contract events...</p>
          </div>
        ) : (
          <div className="relative border-l border-border/80 pl-6 ml-4 space-y-6">
            {events.map((event) => {
              const { icon: Icon, bg } = getEventStyle(event.type);
              return (
                <div key={event.id} className="relative group transition-all duration-300">
                  {/* Event Bullet Node */}
                  <span className={`absolute -left-[37px] top-1 p-2 rounded-full border ${bg} transition-transform duration-300 group-hover:scale-110 shadow-lg shadow-black/40`}>
                    <Icon size={14} />
                  </span>

                  {/* Card Content */}
                  <div className="glass-card rounded-xl p-4 border border-border/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                        {event.title}
                      </h4>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {event.desc}
                    </p>
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
