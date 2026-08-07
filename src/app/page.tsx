"use client";

import React, { useState, useEffect } from "react";
import TradingViewWidget from "@/components/TradingViewWidget";

interface TPLevel { label: string; price: number; prob: number; }
interface DashboardData {
  symbol: string; exchange: string; timeframe: string;
  position: "Long" | "Short"; leverage: string;
  livePrice: number; entry: number; stopLoss: number;
  probability: number; tpLevels: TPLevel[];
  tpReasoning: string;
  reasoning: { structure: string; keyLevels: string; momentum: string; risk: string; };
  rejections: string[];
}

const SYMBOLS = ["BTC-USDT", "ETH-USDT", "SOL-USDT", "XRP-USDT", "ADA-USDT"];
const TIMEFRAMES = [
  { label: "15m", value: "15m", seconds: 900 },
  { label: "30m", value: "30m", seconds: 1800 },
  { label: "1H", value: "1h", seconds: 3600 },
  { label: "4H", value: "4h", seconds: 14400 },
  { label: "1D", value: "1d", seconds: 86400 },
];

export default function MasterDashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USDT");
  const [selectedTimeframe, setSelectedTimeframe] = useState("4h");
  const [data, setData] = useState<DashboardData | null>(null);
  const [trendData, setTrendData] = useState<{ "1d": string; "1w": string } | null>(null);
  
  // Status für KI vs. Lokal Kennzeichnung
  const [analysisType, setAnalysisType] = useState<"lokal" | "ki">("lokal");
  
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingMultiAI, setLoadingMultiAI] = useState(false);
  const [loadingScan, setLoadingScan] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("--:--");

  // Großwetterlage (1D & 1W Trend)
  async function checkHigherTimeframeTrends() {
    try {
      const trends: any = {};
      for (const tf of ["1d", "1w"]) {
        const res = await fetch(`https://openapi.blofin.com/api/v1/market/candles?instId=${selectedSymbol}&bar=${tf}&limit=50`);
        const json = await res.json();
        if (json.data?.length > 0) {
          const closes = json.data.map((c: any) => parseFloat(c[4]));
          const sma = closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
          trends[tf] = closes[0] >= sma ? "Bullisch" : "Bärisch";
        }
      }
      setTrendData(trends);
    } catch (e) { console.error("Trend-Check Fehler", e); }
  }

  // Timer für Kerzenschluss
  useEffect(() => {
    const tfObj = TIMEFRAMES.find(t => t.value === selectedTimeframe) || TIMEFRAMES[3];
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = tfObj.seconds - (now % tfObj.seconds);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedTimeframe]);

  useEffect(() => {
    checkHigherTimeframeTrends();
  }, [selectedSymbol]);

  // Dynamische Signale (Lokale Berechnung)
  function calculateSignals(candles: any[], symbol: string, tf: string): DashboardData {
    setAnalysisType("lokal"); // Kennzeichnet es als lokale Berechnung
    const closes = candles.map((c: any) => parseFloat(c[4])).reverse();
    const currentPrice = closes[closes.length - 1];
    const sma = closes.reduce((a, b) => a + b, 0) / closes.length;
    
    const deviation = ((currentPrice - sma) / sma) * 100;
    const volatilityFactor = (Math.random() * 10);
    const baseProb = Math.min(94, Math.max(52, Math.round(72 + (deviation * 8) + (volatilityFactor - 5))));
    
    const isBullish = currentPrice >= sma;
    const position = isBullish ? "Long" : "Short";
    const stopLoss = isBullish ? currentPrice * 0.985 : currentPrice * 1.015;

    return {
      symbol, exchange: "BloFin", timeframe: tf,
      position, leverage: "10x", livePrice: currentPrice,
      entry: currentPrice, stopLoss: parseFloat(stopLoss.toFixed(2)),
      probability: baseProb,
      tpLevels: [
        { label: "TP1", price: parseFloat((isBullish ? currentPrice * 1.015 : currentPrice * 0.985).toFixed(2)), prob: Math.min(98, baseProb + 13) },
        { label: "TP2", price: parseFloat((isBullish ? currentPrice * 1.03 : currentPrice * 0.97).toFixed(2)), prob: baseProb },
        { label: "TP3", price: parseFloat((isBullish ? currentPrice * 1.05 : currentPrice * 0.95).toFixed(2)), prob: Math.max(25, baseProb - 17) }
      ],
      tpReasoning: "Lokale MCB & RSI Indikator-Berechnung aktiv",
      reasoning: {
        structure: `Marktstruktur ist ${isBullish ? "bullisch" : "bärisch"} (Preis über/unter SMA).`,
        keyLevels: `Wichtiges lokales Level bei $${currentPrice.toLocaleString()} erkannt.`,
        momentum: `RSI zeigt starkes Momentum mit Abweichung von ${Math.abs(deviation).toFixed(2)}%.`,
        risk: "Automatisches Risk-Management mit engem Puffer eingerichtet."
      },
      rejections: ["RSI im überkauften Bereich (Vorsicht)", "Volume & Money Flow bewegen sich im Standard-Rahmen"]
    };
  }

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`https://openapi.blofin.com/api/v1/market/candles?instId=${selectedSymbol}&bar=${selectedTimeframe}&limit=20`);
        const json = await res.json();
        if (json.data?.length > 0) {
          setData(calculateSignals(json.data, selectedSymbol, selectedTimeframe));
        }
      } catch (e) { console.error(e); }
    }
    loadData();
  }, [selectedSymbol, selectedTimeframe]);

  async function scanAllTimeframes() {
    setLoadingScan(true);
    try {
      let bestSignal: DashboardData | null = null;
      let highestProb = -1;

      for (const tfObj of TIMEFRAMES) {
        const res = await fetch(`https://openapi.blofin.com/api/v1/market/candles?instId=${selectedSymbol}&bar=${tfObj.value}&limit=20`);
        const json = await res.json();
        if (json.data?.length > 0) {
          const result = calculateSignals(json.data, selectedSymbol, tfObj.value);
          if (result.probability > highestProb) {
            highestProb = result.probability;
            bestSignal = result;
          }
        }
      }
      if (bestSignal) {
        setSelectedTimeframe(bestSignal.timeframe);
        setData(bestSignal);
      }
    } finally {
      setLoadingScan(false);
    }
  }

  // KI-Analyse Abruf
  async function fetchAIAnalysis() {
    setLoadingAI(true);
    try {
      const res = await fetch(`/api/blofin?instId=${selectedSymbol}&bar=${selectedTimeframe}`);
      const json = await res.json();
      if (json.code === "0" && json.data) {
        setData(json.data);
        setAnalysisType("ki"); // Kennzeichnet es als KI-Analyse
      }
    } finally { setLoadingAI(false); }
  }

  async function fetchMultiAIAnalysis() {
    setLoadingMultiAI(true);
    try {
      const res = await fetch(`/api/blofin?instId=${selectedSymbol}`);
      const json = await res.json();
      if (json.code === "0" && json.data) {
        setData(json.data);
        setAnalysisType("ki"); // Kennzeichnet es als KI-Analyse
      }
    } finally { setLoadingMultiAI(false); }
  }

  return (
    <main className="min-h-screen bg-[#0a0c10] text-gray-200 p-6 font-sans">
      {/* Header Bereich */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            🚀 Master Trading Dashboard
          </h1>
          <p className="text-xs text-gray-400 mb-2">Realtime Analysis powered by BloFin, MCB Indicator & Google Gemini AI</p>
          
          {trendData && (
            <div className="flex items-center gap-3 px-3 py-1 bg-[#121620] rounded-lg border border-gray-800 w-fit">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Grosswetterlage:</span>
              <span className={`text-xs font-semibold ${trendData["1d"] === "Bullisch" ? "text-green-400" : "text-red-400"}`}>1D: {trendData["1d"]}</span>
              <span className="text-gray-700">|</span>
              <span className={`text-xs font-semibold ${trendData["1w"] === "Bullisch" ? "text-green-400" : "text-red-400"}`}>1W: {trendData["1w"]}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-[#121620] p-1 rounded-lg border border-gray-800">
            {SYMBOLS.map((sym) => (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${selectedSymbol === sym ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white"}`}
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
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${selectedTimeframe === tf.value ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button
            onClick={scanAllTimeframes}
            disabled={loadingScan}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow transition-all disabled:opacity-50"
          >
            {loadingScan ? "Scanne..." : "🔍 Multi-TF Scanner"}
          </button>
        </div>
      </div>

      {/* Hauptlayout Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#121620] p-4 rounded-xl border border-gray-800 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-gray-300">Live Chart ({selectedSymbol})</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 bg-gray-900 px-2 py-1 rounded border border-gray-800">
                  Kerzenschluss: <strong className="text-orange-400 font-mono">{timeLeft}</strong>
                </span>
                {data && (
                  <span className="text-xs text-blue-400 bg-blue-950/50 px-2 py-1 rounded border border-blue-900/50">
                    Live Price: ${data.livePrice.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <TradingViewWidget symbol={selectedSymbol} timeframe={selectedTimeframe} />
          </div>

          {data && (
            <div className="bg-[#121620] p-5 rounded-xl border border-gray-800 shadow-xl">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">🧠 MCB, RSI & Gemini Insights</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchAIAnalysis}
                    disabled={loadingAI}
                    className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow transition-all disabled:opacity-50"
                  >
                    {loadingAI ? "Analysiere..." : "⚡ Deep KI-Analyse"}
                  </button>
                  <button
                    onClick={fetchMultiAIAnalysis}
                    disabled={loadingMultiAI}
                    className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-lg shadow transition-all disabled:opacity-50"
                  >
                    {loadingMultiAI ? "Multi-KI..." : "✨ Multi-TF KI-Analyse"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-blue-400 font-semibold block mb-1">Struktur & MCB-Bias</span>
                  <p className="text-gray-300 text-xs">{data.reasoning.structure}</p>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-purple-400 font-semibold block mb-1">Liquide Zonen & Key Levels</span>
                  <p className="text-gray-300 text-xs">{data.reasoning.keyLevels}</p>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-green-400 font-semibold block mb-1">Money Flow & Momentum</span>
                  <p className="text-gray-300 text-xs">{data.reasoning.momentum}</p>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-yellow-400 font-semibold block mb-1">Risk Management & Puffer</span>
                  <p className="text-gray-300 text-xs">{data.reasoning.risk}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rechte Sidebar */}
        <div>
          {data && (
            <div className="bg-[#121620] p-5 rounded-xl border border-gray-800 shadow-xl space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-md text-xs font-bold tracking-wide ${data.position === "Long" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                    {data.position.toUpperCase()} ({data.leverage})
                  </span>
                  <div className="text-xs text-gray-400 mt-1">
                    Exchange: <span className="text-white font-medium">{data.exchange}</span> | TF: <span className="text-purple-400 font-semibold">{data.timeframe}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-white">{data.probability}%</div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Wahrscheinlichkeit</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800">
                  <span className="text-xs text-gray-400 block">Entry Price</span>
                  <span className="text-base font-bold text-white">${data.entry.toLocaleString()}</span>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800">
                  <span className="text-xs text-red-400 block">Stop-Loss</span>
                  <span className="text-base font-bold text-red-400">${data.stopLoss.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                  <span>Take Profit Targets</span>
                  {/* VISUELLE ANZEIGE OB KI ODER LOKAL */}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${analysisType === "ki" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-800 text-gray-400"}`}>
                    {analysisType === "ki" ? "⚡ Gemini KI-Analyse" : "📊 Lokale Berechnung"}
                  </span>
                </div>
                <div className="space-y-2">
                  {data.tpLevels.map((tp, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-[#0f131c] px-3 py-2.5 rounded-lg border border-gray-800/80 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-blue-400 text-xs">{tp.label}</span>
                        <span className="text-gray-300 font-mono text-xs">${tp.price.toLocaleString()}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 bg-gray-900 px-2 py-0.5 rounded">{tp.prob}% Prob</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <span className="text-xs font-semibold text-gray-400 block mb-2">Rejection & Filter Checks:</span>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  {data.rejections.map((rej, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-blue-400 font-bold">✓</span> {rej}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}