"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Play, RefreshCw, AlertCircle, Lock } from "lucide-react";
import TradingViewWidget from "../components/TradingViewWidget";

interface TakeProfitLevel {
  label: string;
  price: number;
  prob: number;
}

interface AnalysisData {
  symbol: string;
  exchange: string;
  timeframe: string;
  position: "Long" | "Short";
  leverage: string;
  entry: number;
  stopLoss: number;
  probability: number;
  tpLevels: TakeProfitLevel[];
  tpReasoning: string;
  reasoning: {
    structure: string;
    keyLevels: string;
    momentum: string;
    risk: string;
  };
  rejections: string[];
}

export default function TradingDashboard() {
  const [asset, setAsset] = useState("BTC");
  const [exchange, setExchange] = useState("BloFin");
  const [marginMode, setMarginMode] = useState("Isolated");
  const [multiTf, setMultiTf] = useState("ALL");
  const [singleTf, setSingleTf] = useState("1h");
  const [minProb, setMinProb] = useState("65%");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [analysisData, setAnalysisData] = useState<AnalysisData>({
    symbol: "BTCUSDT",
    exchange: "BloFin",
    timeframe: "1h",
    position: "Long",
    leverage: "10x",
    entry: 62978.5,
    stopLoss: 62485.1,
    probability: 69,
    tpLevels: [
      { label: "TP1", price: 63188.0, prob: 69 },
      { label: "TP2", price: 63376.0, prob: 60 },
      { label: "TP3", price: 63576.7, prob: 54 },
      { label: "TP4", price: 64120.0, prob: 42 },
    ],
    tpReasoning: "TP1: Structure, TP2: Extended Pivots, TP3/TP4: Pivot Zones",
    reasoning: {
      structure: "Bullish Trend 1h Structure",
      keyLevels: "Using recent swings for stops/targets (TP2 refined).",
      momentum: "Computed from Market Cipher AI indicator set.",
      risk: "Stop = structural anchor + volatility buffer.",
    },
    rejections: [
      "5m No Call – 55% No clear direction MC -2..1",
      "15m Short – 70% E: 62978.5 S: 63147.5 TP1: 62602.4",
      "4h Short – 60% E: 62978.5 S: 63773.0 TP1: 61850.7",
    ],
  });

  const handleRunAnalysis = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const formattedSymbol = `${asset}-USDT`;
      const res = await fetch(`/api/blofin?instId=${formattedSymbol}&bar=${singleTf}`);
      const json = await res.json();

      if (json.code === "0" && json.data) {
        setAnalysisData((prev) => {
          const liveEntry = json.data.livePrice || json.data.entry || prev.entry;
          const isLong = (json.data.position || "Long") === "Long";

          const defaultTps: TakeProfitLevel[] = [
            { label: "TP1", price: isLong ? liveEntry * 1.005 : liveEntry * 0.995, prob: 69 },
            { label: "TP2", price: isLong ? liveEntry * 1.010 : liveEntry * 0.990, prob: 60 },
            { label: "TP3", price: isLong ? liveEntry * 1.015 : liveEntry * 0.985, prob: 54 },
            { label: "TP4", price: isLong ? liveEntry * 1.025 : liveEntry * 0.975, prob: 42 },
          ];

          return {
            ...prev,
            symbol: `${asset}USDT`,
            timeframe: singleTf,
            position: json.data.position || "Long",
            entry: liveEntry,
            stopLoss: json.data.stop || (isLong ? liveEntry * 0.99 : liveEntry * 1.01),
            probability: json.data.probability || prev.probability,
            tpLevels: json.data.tpLevels && json.data.tpLevels.length > 0 ? json.data.tpLevels : defaultTps,
            tpReasoning: json.data.tpReasoning || prev.tpReasoning,
            reasoning: json.data.reasoning || prev.reasoning,
            rejections: json.data.rejections || prev.rejections,
          };
        });
      } else {
        setErrorMsg(json.msg || "Fehler beim Laden der Analysedaten.");
      }
    } catch {
      setErrorMsg("Verbindungsfehler zur API.");
    } finally {
      setIsLoading(false);
    }
  }, [asset, singleTf]);

  useEffect(() => {
    handleRunAnalysis();
  }, [handleRunAnalysis]);

  const formatPrice = (val: number) =>
    val ? val.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : "0.0";

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-200 p-4 lg:p-6 font-sans">
      
      {/* HEADER */}
      <div className="max-w-[1600px] mx-auto mb-4 flex items-center justify-between border-b border-gray-800/60 pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-1">
            <span className="text-indigo-500">My Master</span> Dashboard
            <span className="text-[10px] bg-indigo-600/30 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 font-semibold ml-1.5">v2.05</span>
          </h1>
        </div>
        <p className="text-xs text-gray-400 font-medium hidden sm:block">
          AI That Watches the Market So You Don't Have To
        </p>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* SIDEBAR */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[#10131c] border border-gray-800/80 rounded-xl p-4 space-y-4 shadow-xl">
            
            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1.5">ASSET</label>
              <select
                className="w-full bg-[#181c28] border border-gray-700/60 rounded-md px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
              >
                <option value="BTC">BTC / USDT</option>
                <option value="ETH">ETH / USDT</option>
                <option value="SOL">SOL / USDT</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1.5">EXCHANGE</label>
              <select
                className="w-full bg-[#181c28] border border-gray-700/60 rounded-md px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
              >
                <option value="BloFin">BloFin (Connected Live)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1.5">MARGIN MODE</label>
              <select
                className="w-full bg-[#181c28] border border-gray-700/60 rounded-md px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                value={marginMode}
                onChange={(e) => setMarginMode(e.target.value)}
              >
                <option value="Isolated">Isolated</option>
                <option value="Cross">Cross</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1.5">MULTI TIMEFRAME</label>
              <div className="grid grid-cols-5 gap-1">
                {["TURBO", "SCALP", "INTRA", "SWING", "ALL"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setMultiTf(mode)}
                    className={`py-1 text-[9px] font-bold rounded ${
                      multiTf === mode
                        ? "bg-indigo-600 text-white"
                        : "bg-[#181c28] text-gray-400 hover:bg-[#202534]"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1.5">SINGLE TIMEFRAME</label>
              <div className="grid grid-cols-6 gap-1">
                {["1m", "5m", "15m", "1h", "4h", "1D"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSingleTf(tf)}
                    className={`py-1 text-[10px] font-bold rounded ${
                      singleTf === tf
                        ? "bg-indigo-600 text-white"
                        : "bg-[#181c28] text-gray-400 hover:bg-[#202534]"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1.5">MIN PROBABILITY</label>
              <select
                className="w-full bg-[#181c28] border border-gray-700/60 rounded-md px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                value={minProb}
                onChange={(e) => setMinProb(e.target.value)}
              >
                <option value="50%">50%</option>
                <option value="60%">60%</option>
                <option value="65%">65%</option>
                <option value="75%">75%</option>
              </select>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleRunAnalysis}
              disabled={isLoading}
              className="w-full bg-[#2a2e3d] hover:bg-[#343a4d] text-white py-2.5 rounded-md text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={14} /> : <Play size={14} />}
              {isLoading ? "ANALYZING..." : "RUN ANALYSIS"}
            </button>
          </div>

          <div className="bg-[#10131c] border border-gray-800/80 rounded-xl p-4 space-y-3">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">FORCE TRADE</div>
            <div className="grid grid-cols-3 gap-1">
              <select className="bg-[#181c28] border border-gray-700/60 text-xs rounded px-1.5 py-1 text-white">
                <option>5M</option>
                <option>15M</option>
              </select>
              <button className="bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded py-1">
                LONG
              </button>
              <div className="bg-[#181c28] border border-gray-700/60 rounded flex items-center justify-between px-2 text-xs text-gray-300">
                <span>1%</span>
                <Lock size={10} className="text-gray-500" />
              </div>
            </div>

            <button className="w-full bg-amber-600/20 border border-amber-500/50 hover:bg-amber-600/30 text-amber-300 text-xs font-bold py-2 rounded transition flex justify-center items-center gap-1.5 cursor-pointer">
              <span>⚡ Enter Trade</span>
            </button>
          </div>
        </div>

        {/* MAIN AREA */}
        <div className="lg:col-span-9 space-y-5">
          
          {/* TRADINGVIEW CHART BOX */}
          <div className="bg-[#10131c] border border-gray-800/80 rounded-xl p-3 shadow-xl overflow-hidden">
            <TradingViewWidget symbol={`${asset}-USDT`} timeframe={singleTf} />
          </div>

          {/* ANALYSIS DISPLAY */}
          <div className="bg-[#10131c] border border-gray-800/80 rounded-xl p-5 space-y-5 shadow-xl">
            
            <div className="flex justify-between items-start border-b border-gray-800/60 pb-3">
              <div>
                <h2 className="text-xl font-bold text-indigo-400">
                  {analysisData.symbol} <span className="text-gray-400 font-normal">@ {analysisData.exchange.toUpperCase()}</span>
                </h2>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">PROBABILITY</div>
                <div className="text-3xl font-black text-indigo-400 leading-none mt-0.5">{analysisData.probability}%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#161a26] p-3 rounded border border-gray-800/80">
                <div className="text-[9px] text-gray-500 font-bold uppercase">TIMEFRAME</div>
                <div className="text-base font-bold text-indigo-400 mt-1">{analysisData.timeframe}</div>
              </div>
              <div className="bg-[#161a26] p-3 rounded border border-gray-800/80">
                <div className="text-[9px] text-gray-500 font-bold uppercase">POSITION</div>
                <div className={`text-base font-bold mt-1 ${analysisData.position === "Long" ? "text-emerald-400" : "text-red-400"}`}>
                  {analysisData.position}
                </div>
              </div>
              <div className="bg-[#161a26] p-3 rounded border border-gray-800/80">
                <div className="text-[9px] text-gray-500 font-bold uppercase">LEVERAGE</div>
                <div className="text-base font-bold text-indigo-400 mt-1">{analysisData.leverage}</div>
              </div>
              <div className="bg-[#161a26] p-3 rounded border border-gray-800/80">
                <div className="text-[9px] text-gray-500 font-bold uppercase">ENTRY</div>
                <div className="text-base font-bold text-emerald-400 mt-1">{formatPrice(analysisData.entry)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#161a26] p-3 rounded border border-red-900/30">
                <div className="text-[9px] text-red-500 font-bold uppercase">STOP</div>
                <div className="text-base font-bold text-red-400 mt-1">{formatPrice(analysisData.stopLoss)}</div>
              </div>

              {analysisData.tpLevels.map((tp) => (
                <div key={tp.label} className="bg-[#161a26] p-3 rounded border border-emerald-900/30">
                  <div className="text-[9px] text-emerald-500 font-bold uppercase">{tp.label}</div>
                  <div className="text-base font-bold text-emerald-400 mt-1">{formatPrice(tp.price)}</div>
                  <div className="text-[10px] text-indigo-400 font-medium mt-0.5">{tp.prob}%</div>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-gray-400">
              <span className="font-bold text-gray-300">TP Reason:</span> {analysisData.tpReasoning}
            </div>

            <div className="space-y-2 border-t border-gray-800/60 pt-4">
              <h3 className="text-sm font-bold text-gray-200">Reasoning:</h3>
              <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
                <li><strong className="text-gray-200">Structure Trend:</strong> {analysisData.reasoning.structure}</li>
                <li><strong className="text-gray-200">Key Levels:</strong> {analysisData.reasoning.keyLevels}</li>
                <li><strong className="text-gray-200">Momentum:</strong> {analysisData.reasoning.momentum}</li>
                <li><strong className="text-gray-200">Risk:</strong> {analysisData.reasoning.risk}</li>
              </ul>
            </div>

            <div className="space-y-2 border-t border-gray-800/60 pt-4">
              <h3 className="text-sm font-bold text-gray-200">Rejections:</h3>
              <ul className="text-xs text-gray-400 space-y-1">
                {analysisData.rejections.map((rej, idx) => (
                  <li key={idx}>• {rej}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-800/60 pt-3 text-[10px] text-gray-500 leading-relaxed">
              <strong>Disclaimer:</strong> This analysis is a snapshot of {analysisData.symbol} at this present time. Prices can change rapidly due to market volatility, and this is not financial advice.
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}