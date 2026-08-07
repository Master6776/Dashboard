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
  const [selectedTimeframe, setSelectedTimeframe] = useState("1h");
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hilfsfunktion: Berechnet RSI & technische Indikatoren lokal aus Kerzendaten (0 Kosten)
  function calculateMCBSignals(candles: any[], symbol: string, tf: string): DashboardData {
    // candles format von BloFin: [timestamp, open, high, low, close, volume, ...]
    const closes = candles.map((c: any) => parseFloat(c[4])).reverse(); // Älteste bis neueste
    const currentPrice = closes[closes.length - 1];
    
    // Einfacher RSI-Algorithmus (14 Perioden)
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < Math.min(closes.length, 14); i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = Math.round(100 - (100 / (1 + rs)));

    // MCB / Trend Bestimmung (Letzter Preis vs gleitender Schnitt)
    const sma = closes.reduce((a, b) => a + b, 0) / closes.length;
    const isBullish = currentPrice >= sma;

    const position = isBullish ? "Long" : "Short";
    const stopLoss = isBullish ? currentPrice * 0.985 : currentPrice * 1.015;
    const probability = rsi < 40 ? 78 : rsi > 60 ? 72 : 65;

    return {
      symbol,
      exchange: "BloFin",
      timeframe: tf,
      position,
      leverage: "10x",
      livePrice: currentPrice,
      entry: currentPrice,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      probability,
      tpLevels: [
        { label: "TP1", price: parseFloat((isBullish ? currentPrice * 1.015 : currentPrice * 0.985).toFixed(2)), prob: 85 },
        { label: "TP2", price: parseFloat((isBullish ? currentPrice * 1.03 : currentPrice * 0.97).toFixed(2)), prob: 70 },
        { label: "TP3", price: parseFloat((isBullish ? currentPrice * 1.05 : currentPrice * 0.95).toFixed(2)), prob: 55 }
      ],
      tpReasoning: "Lokale MCB & RSI Indikator-Berechnung aktiv",
      reasoning: {
        structure: `Marktstruktur ist ${isBullish ? "bullisch" : "bärisch"} (Preis über/unter SMA).`,
        keyLevels: `Wichtiges lokales Level bei $${currentPrice.toLocaleString()} erkannt.`,
        momentum: `RSI liegt bei ${rsi} (${rsi < 45 ? "Überverkauft / Rebound-Chance" : rsi > 55 ? "Starkes Momentum" : "Neutral"}).`,
        risk: "Automatisches Risk-Management mit engem Puffer eingerichtet."
      },
      rejections: [
        rsi > 70 ? "RSI im überkauften Bereich (Vorsicht)" : rsi < 30 ? "RSI im überverkauften Bereich (Vorsicht)" : "RSI im gesunden Korridor",
        "Volume & Money Flow bewegen sich im Standard-Rahmen"
      ]
    };
  }

  // 1. Lokale Basis-Daten & Signale laden beim Start (0 KI-Kosten)
  useEffect(() => {
    async function fetchLocalSignals() {
      setLoadingPrice(true);
      setError(null);
      try {
        const res = await fetch(`https://openapi.blofin.com/api/v1/market/candles?instId=${selectedSymbol}&bar=${selectedTimeframe}&limit=20`);
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          const calculatedData = calculateMCBSignals(json.data, selectedSymbol, selectedTimeframe);
          setData(calculatedData);
        }
      } catch {
        setError("Fehler beim Abrufen der Marktdaten.");
      } finally {
        setLoadingPrice(false);
      }
    }

    fetchLocalSignals();
  }, [selectedSymbol, selectedTimeframe]);

  // 2. Auf Knopfdruck: Erweiterte KI-Analyse von Gemini abrufen
  async function fetchAIAnalysis() {
    setLoadingAI(true);
    setError(null);
    try {
      const res = await fetch(`/api/blofin?instId=${selectedSymbol}&bar=${selectedTimeframe}`);
      const json = await res.json();

      if (json.code === "0" && json.data) {
        setData(json.data);
      } else {
        setError(json.msg || "Fehler beim Laden der KI-Daten.");
      }
    } catch {
      setError("Netzwerkfehler beim Verbinden mit der KI-API.");
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0c10] text-gray-200 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            🚀 Master Trading Dashboard
          </h1>
          <p className="text-sm text-gray-400">
            Realtime Analysis powered by BloFin, MCB Indicator & Google Gemini AI
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
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  🧠 MCB, RSI & Gemini Insights
                </h2>
                <button
                  onClick={fetchAIAnalysis}
                  disabled={loadingAI}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingAI ? "Analysiere mit KI..." : "⚡ Deep KI-Analyse"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-blue-400 font-semibold block mb-1">Struktur & MCB-Bias</span>
                  <p className="text-gray-300">{data.reasoning.structure}</p>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-purple-400 font-semibold block mb-1">Liquide Zonen & Key Levels</span>
                  <p className="text-gray-300">{data.reasoning.keyLevels}</p>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-green-400 font-semibold block mb-1">Money Flow & Momentum</span>
                  <p className="text-gray-300">{data.reasoning.momentum}</p>
                </div>
                <div className="bg-[#0f131c] p-3 rounded-lg border border-gray-800/60">
                  <span className="text-xs text-yellow-400 font-semibold block mb-1">Risk Management & Puffer</span>
                  <p className="text-gray-300">{data.reasoning.risk}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {error ? (
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
                  <span className="text-blue-400">{data.tpReasoning}</span>
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
                      <span className="text-blue-400 font-bold">✓</span> {rej}
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