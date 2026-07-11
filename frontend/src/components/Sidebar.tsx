"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Settings, 
  Activity, 
  Coins, 
  ArrowUpRight,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Activity Feed", href: "/activity", icon: Activity },
  { name: "Transactions", href: "/transactions", icon: Coins },
  { name: "Analytics", href: "/analytics", icon: TrendingUp },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // If we are on landing page, we might want a different view or still show sidebar.
  // Let's show sidebar on all inner pages, and let it be toggled or styled beautifully.
  if (pathname === "/") return null; // Hide sidebar on marketing landing page

  const toggleMobile = () => setMobileOpen(!mobileOpen);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={toggleMobile}
        className="md:hidden fixed bottom-6 right-6 z-50 p-3 bg-primary text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all"
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Container */}
      <aside className={clsx(
        "w-64 h-full bg-card border-r border-border flex flex-col justify-between z-40 transition-transform duration-300 md:translate-x-0 md:static fixed inset-y-0 left-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-border gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center font-bold text-white shadow-md shadow-primary/20">
              E
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                EquiRise
              </span>
              <span className="text-[10px] text-primary font-bold block leading-none">
                SYNDICATE
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                    isActive 
                      ? "bg-primary text-white shadow-md shadow-primary/10" 
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-white"
                  )}
                >
                  <Icon size={18} className={clsx(
                    "transition-transform",
                    !isActive && "group-hover:scale-110"
                  )} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Area / Developer Belt info */}
        <div className="p-4 border-t border-border">
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-white">Stellar Level 3</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              EquiRise operates on advanced Soroban smart contract logic.
            </p>
            <Link 
              href="/"
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 mt-1"
            >
              Learn Architecture <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
