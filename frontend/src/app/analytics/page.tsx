"use client";

import { useState, useEffect } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { TrendingUp, Award, Users, BarChart3, Loader2 } from "lucide-react";

// Mock data
const performanceData = [
  { month: "Jan", capital: 12000, returns: 5000 },
  { month: "Feb", capital: 25000, returns: 10000 },
  { month: "Mar", capital: 55000, returns: 25000 },
  { month: "Apr", capital: 80000, returns: 40000 },
  { month: "May", capital: 150000, returns: 90000 },
  { month: "Jun", capital: 202500, returns: 160000 },
];

const allocationData = [
  { name: "DeFi Aggregators", value: 40 },
  { name: "Gaming & Web3", value: 25 },
  { name: "Real Estate Platforms", value: 20 },
  { name: "FinTech & Payments", value: 15 },
];

const COLORS = ["#f97316", "#3b82f6", "#8b5cf6", "#10b981"];

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview Intro */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Syndicate Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Platform-wide statistics, allocation trends, and historic yield distribution curves.
        </p>
      </div>

      {/* Grid of charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Performance Area Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Capital Growth & Yields</h3>
              <p className="text-[11px] text-muted-foreground">Cumulative values of invested capital vs returned payouts.</p>
            </div>
            <span className="text-xs bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full font-bold uppercase tracking-wide">
              Cumulative Growth
            </span>
          </div>

          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f0f12", borderColor: "#27272a", borderRadius: "12px" }}
                  labelStyle={{ color: "#fff", fontWeight: "bold" }}
                />
                <Area type="monotone" dataKey="capital" name="Invested Capital" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorCapital)" />
                <Area type="monotone" dataKey="returns" name="Yield Returns" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorReturns)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sectors Pie Chart */}
        <div className="lg:col-span-1 glass-panel rounded-2xl border border-border p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Syndicate Sector Allocation</h3>
            <p className="text-[11px] text-muted-foreground">Percentage split of funding across industry verticals.</p>
          </div>

          <div className="h-60 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f0f12", borderColor: "#27272a", borderRadius: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Custom Legends */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {allocationData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                <span className="text-muted-foreground truncate">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Historic stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-6 border border-border flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><Award size={24} /></div>
          <div>
            <span className="text-xs text-muted-foreground block">Average Return Multiple</span>
            <span className="text-lg font-bold text-white">1.78x ROI</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><Users size={24} /></div>
          <div>
            <span className="text-xs text-muted-foreground block">Unique Backers</span>
            <span className="text-lg font-bold text-white">1,480 Investors</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-border flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><BarChart3 size={24} /></div>
          <div>
            <span className="text-xs text-muted-foreground block">Syndicate Success Rate</span>
            <span className="text-lg font-bold text-white">92.5%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
