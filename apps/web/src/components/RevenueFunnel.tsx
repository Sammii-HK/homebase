"use client";

import type { DashboardStats } from "@/types/dashboard";

interface Props {
  stats: DashboardStats | null;
}

type LunaryExtended = DashboardStats["lunary"] & {
  wau?: number;
  signups7d?: number;
  signups30d?: number;
};

export default function RevenueFunnel({ stats }: Props) {
  const lunary = stats?.lunary as LunaryExtended | undefined;

  const signups7d = lunary?.signups7d ?? 0;
  const signups30d = lunary?.signups30d ?? signups7d * 4;
  const wau = lunary?.wau ?? 0;
  const mau = lunary?.mau ?? 0;
  const mrr = lunary?.mrr ?? 0;
  const paying = mrr > 0 ? Math.round(mrr / 4.99) : 0; // estimate from MRR

  const toActive = mau > 0 && signups30d > 0 ? Math.round((mau / Math.max(mau, signups30d)) * 100) : null;
  const toPaying = mau > 0 ? (paying > 0 ? Math.round((paying / mau) * 100) : 0) : null;

  const bottleneck = mrr === 0 ? "No paying users yet — conversion wall at step 3" : toPaying !== null && toPaying < 5 ? "Conversion to paid is low — focus on paywall" : null;

  const steps = [
    {
      label: "Signups (30d)",
      value: signups30d > 0 ? String(signups30d) : "-",
      sub: signups7d > 0 ? `${signups7d} this week` : null,
      color: "#a78bfa",
      hot: false,
    },
    {
      label: "Monthly Active",
      value: mau > 0 ? String(mau) : "-",
      sub: wau > 0 ? `${wau} weekly active` : null,
      color: "#818cf8",
      hot: false,
    },
    {
      label: "Paying",
      value: mrr > 0 ? `${paying}` : "0",
      sub: mrr > 0 ? `£${mrr.toFixed(0)} MRR` : "£0 MRR — beta coupons",
      color: mrr > 0 ? "#34d399" : "#374151",
      hot: mrr === 0,
    },
  ];

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[8px] md:text-xs uppercase tracking-wider text-white/40">
          Revenue Funnel
        </p>
        {bottleneck && (
          <span
            className="text-[6px] md:text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            BLOCKED
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1 flex-1">
            <div
              className="flex-1 rounded p-2 text-center"
              style={{
                background: step.hot ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${step.hot ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <p
                className="text-sm md:text-lg font-bold"
                style={{ color: step.color }}
              >
                {step.value}
              </p>
              <p className="text-[6px] md:text-[10px] text-white/35 mt-0.5 leading-tight">
                {step.label}
              </p>
              {step.sub && (
                <p className="text-[5px] md:text-[9px] text-white/20 mt-0.5 leading-tight">
                  {step.sub}
                </p>
              )}
            </div>
            {i < steps.length - 1 && (
              <span className="text-white/15 text-xs shrink-0">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Conversion rates */}
      <div className="flex gap-2 mt-2">
        {toActive !== null && (
          <div className="flex-1 text-center">
            <p className="text-[6px] md:text-[9px] text-white/25">
              {toActive}% retention
            </p>
          </div>
        )}
        <div className="flex-1" />
        {toPaying !== null && (
          <div className="flex-1 text-center">
            <p
              className="text-[6px] md:text-[9px]"
              style={{ color: toPaying === 0 ? "#f87171" : toPaying < 5 ? "#fbbf24" : "#34d399" }}
            >
              {toPaying}% to paid
            </p>
          </div>
        )}
      </div>

      {/* Bottleneck callout */}
      {bottleneck && (
        <div
          className="mt-2 rounded px-2 py-1.5"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}
        >
          <p className="text-[6px] md:text-[10px] text-red-400/80">{bottleneck}</p>
        </div>
      )}
    </div>
  );
}
