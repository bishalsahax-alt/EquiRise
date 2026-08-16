"use client";

import React from "react";
import Link from "next/link";
import { clsx } from "clsx";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  subtitle?: string;
  href?: string;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}

export function LogoIcon({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizeMap = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const idSuffix = React.useId().replace(/:/g, "");

  return (
    <div className={clsx("relative flex items-center justify-center shrink-0 group", sizeMap[size], className)}>
      {/* Glow aura */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary via-orange-500 to-amber-400 rounded-xl blur-md opacity-40 group-hover:opacity-80 transition-opacity duration-300" />

      {/* Vector Logo Emblem */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-lg group-hover:scale-105 transition-transform duration-300"
      >
        <defs>
          <linearGradient id={`eqLogoGrad_${idSuffix}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="45%" stopColor="#FF5E00" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>

          <linearGradient id={`eqShinyGrad_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FF8A00" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id={`eqBaseGrad_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E1B4B" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.98" />
          </linearGradient>

          <filter id={`eqGlowFilter_${idSuffix}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Squircle Base Frame */}
        <rect
          x="5"
          y="5"
          width="90"
          height="90"
          rx="24"
          fill={`url(#eqBaseGrad_${idSuffix})`}
          stroke={`url(#eqLogoGrad_${idSuffix})`}
          strokeWidth="3"
        />

        {/* Inner Bevel Highlight */}
        <rect
          x="8"
          y="8"
          width="84"
          height="84"
          rx="21"
          stroke="#FFFFFF"
          strokeOpacity="0.12"
          strokeWidth="1.5"
        />

        {/* 'E' Monogram Base Bars */}
        <rect x="22" y="24" width="14" height="52" rx="4" fill={`url(#eqLogoGrad_${idSuffix})`} />
        <rect x="36" y="64" width="32" height="12" rx="4" fill={`url(#eqLogoGrad_${idSuffix})`} />
        <rect x="36" y="44" width="24" height="11" rx="3.5" fill={`url(#eqLogoGrad_${idSuffix})`} />

        {/* Ascending Trend Line & Growth Arrow */}
        <path
          d="M 36 24 H 56 L 78 24 L 78 46 L 66 34 L 50 50 L 36 36 V 24 Z"
          fill={`url(#eqLogoGrad_${idSuffix})`}
          filter={`url(#eqGlowFilter_${idSuffix})`}
        />

        <path
          d="M 28 58 L 46 40 L 56 50 L 76 28"
          stroke={`url(#eqShinyGrad_${idSuffix})`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M 64 28 H 76 V 40"
          stroke={`url(#eqShinyGrad_${idSuffix})`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Sparkling Peak Node */}
        <circle cx="76" cy="28" r="3.5" fill="#FFFFFF" className="animate-pulse" />
      </svg>
    </div>
  );
}

export default function Logo({
  size = "md",
  showText = true,
  subtitle,
  href,
  className,
  interactive = true,
  onClick,
}: LogoProps) {
  const textSizeMap = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  const subtitleSizeMap = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-[11px]",
    xl: "text-xs",
  };

  const content = (
    <div className={clsx("inline-flex items-center gap-3 select-none group", className)}>
      <LogoIcon size={size} />

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className={clsx("font-extrabold tracking-tight text-white group-hover:text-white transition-colors", textSizeMap[size])}>
              Equi<span className="bg-gradient-to-r from-primary via-orange-400 to-amber-300 bg-clip-text text-transparent">Rise</span>
            </span>
          </div>

          {subtitle && (
            <span
              className={clsx(
                "font-bold uppercase tracking-widest text-primary/90 block leading-none mt-0.5",
                subtitleSizeMap[size]
              )}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={clsx(
          "focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-xl transition-all",
          interactive && "hover:opacity-95"
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div onClick={onClick} className={clsx(onClick && "cursor-pointer")}>
      {content}
    </div>
  );
}
