"use client";

import React, { useState, useEffect } from "react";
import TradingViewWidget from "@/components/TradingViewWidget";

interface TPLevel {
  label: string;
  price: number;
  prob: number;
}

interface DashboardData {
  symbol: string;
  exchange: string;
  timeframe: string;
  position: "Long" | "Short";
  leverage: string;
  livePrice: number;
  entry: number;
  stopLoss: number;
  probability: number;
  tpLevels: TPLevel[];
  tpReasoning: string;
  reasoning: {
    structure: string;
    keyLevels: string;
    momentum: string;
    risk: string;
  };
  rejections: string[];
}

const SYMBOLS = ["BTC-USDT", "ETH-USDT", "SOL-USDT", "XRP-USDT", "ADA-USDT"];
const TIMEFRAMES = [
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
];

export default function MasterDashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USDT");
  const [selectedTimeframe, setSelectedTimeframe] = useState("4h");
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/blofin?instId=${selectedSymbol}&bar=${selectedTimeframe}`);
        const json = await res.json();

        if (json.code === "0" && json.data) {
          setData(json.data);
        } else {
          setError(json.msg || "Fehler beim Laden der Daten.");
        }
      } catch {
        setError("Netzwerkfehler beim Verbinden mit der API.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [selectedSymbol, selectedTimeframe]);

  return (
    <main className="min-h-screen bg-[#0a0c10] text-gray-200 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            🚀 Master Trading Dashboard
          </h1>
          <p className="text-sm text-gray-400">
            Realtime Analysis powered by BloFin & Google Gemini AI
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-[#121620] p-1 rounded-lg border border-gray-800">
            {SYMBOLS.map((sym) => (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  selectedSymbol === sym
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {sym.replace("-USDT", "")}
              </button>
            ))}
          </div>

          <div className="flex bg-[#121620] p-1 rounded-lg border border-gray-800">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setSelectedTimeframe(tf.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  selectedTimeframe === tf.value
                    ? "bg-gray-700 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#121620] p-4 rounded-xl border border-gray-800 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-gray-300">
                Live Chart ({selectedSymbol})
              </span>
              {data && (
                <span className="text-xs text-blue-400 bg-blue-950/50 px-2 py-1 rounded border border-blue-900/50">
                  Live Price: ${data.livePrice.toLocaleString()}
                </span>
              )}
            </div>
            <TradingViewWidget symbol={selectedSymbol} timeframe={selectedTimeframe} />
          </div>

          {data && (
            <div className="bg-[#121620] p-5 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                🧠 Gemini AI Insights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-gray-500 block mb-1">Struktur & Momentum</span>
                  <p className="text-gray-300">{data.reasoning.structure}</p>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-gray-500 block mb-1">Key Levels</span>
                  <p className="text-gray-300">{data.reasoning.keyLevels}</p>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-gray-500 block mb-1">Probability Score</span>
                  <p className="text-gray-300">{data.reasoning.momentum}</p>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-gray-500 block mb-1">Risk Management</span>
                  <p className="text-gray-300">{data.reasoning.risk}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="bg-[#121620] p-8 rounded-xl border border-gray-800 text-center text-gray-400">
              Frage Google Gemini AI...
            </div>
          ) : error ? (
            <div className="bg-red-950/40 p-4 rounded-xl border border-red-900 text-red-300 text-sm">
              {error}
            </div>
          ) : data ? (
            <div className="bg-[#121620] p-5 rounded-xl border border-gray-800 shadow-xl space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                <div>
                  <span
                    className={`inline-block px-3 py-1 rounded-md text-xs font-bold tracking-wide ${
                      data.position === "Long"
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {data.position.toUpperCase()} ({data.leverage})
                  </span>
                  <div className="text-xs text-gray-400 mt-1">
                    Exchange: <span className="text-white font-medium">{data.exchange}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-white">
                    {data.probability}%
                  </div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Wahrscheinlichkeit</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800">
                  <span className="text-xs text-gray-400 block">Entry Price</span>
                  <span className="text-lg font-bold text-white">${data.entry.toLocaleString()}</span>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800">
                  <span className="text-xs text-red-400 block">Stop-Loss</span>
                  <span className="text-lg font-bold text-red-400">${data.stopLoss.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                  <span>Take Profit Targets</span>
                  <span>{data.tpReasoning}</span>
                </div>
                <div className="space-y-2">
                  {data.tpLevels.map((tp, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-[#0f131c] px-3 py-2.5 rounded-lg border border-gray-800/80 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-blue-400">{tp.label}</span>
                        <span className="text-gray-300 font-mono">${tp.price.toLocaleString()}</span>
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded">
                        {tp.prob}% Prob
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <span className="text-xs font-semibold text-gray-400 block mb-2">
                  Rejection & Filter Checks:
                </span>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  {data.rejections.map((rej, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-red-400 font-bold">✕</span> {rej}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}