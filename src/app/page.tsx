"use client";

import React, { useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import TradingViewWidget from "../components/TradingViewWidget";

export default function TradingDashboard() {
  const [asset, setAsset] = useState("BTC-USDT");
  const [marginMode, setMarginMode] = useState("Isolated");
  const [multiTf, setMultiTf] = useState("ALL");
  // Default auf 1H
  const [singleTf, setSingleTf] = useState("1H"); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Default auf 1H
  const [analysisData, setAnalysisData] = useState({
    probability: 70,
    timeframe: "1H", 
    position: "Long",
    leverage: "10x",
    entry: 64850,
    stop: 63553,
    tp1: 67444,
    rsi: 48,
    reasoning: ["Drücke RUN ANALYSIS um die Daten zu laden..."]
  });

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // API Call nutzt jetzt immer das aktuelle singleTf (1H)
      const res = await fetch(`/api/blofin?instId=${asset}&bar=${singleTf}`);
      const json = await res.json();
      if (json.code === "0") {
        setAnalysisData({
          probability: json.data.probability,
          timeframe: singleTf, // Zeigt den gewählten Tf an
          position: json.data.position,
          leverage: "10x",
          entry: json.data.livePrice,
          stop: json.data.stop,
          tp1: json.data.tp1,
          rsi: json.data.rsi,
          reasoning: json.data.reasoning
        });
      }
    } catch {
      setErrorMsg("Fehler beim Abruf.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-gray-200 p-6 flex justify-center">
      <div className="w-full max-w-7xl flex gap-6">
        
        {/* LINKS: SIDEBAR */}
        <div className="w-80 bg-[#10121a] border border-gray-800 rounded-xl p-5 flex flex-col gap-6">
          
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">ASSET (BLOFIN)</label>
            <select 
              className="w-full bg-[#181a24] border border-gray-700 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" 
              value={asset} 
              onChange={(e) => setAsset(e.target.value)}
            >
              <option value="BTC-USDT">BTC / USDT</option>
              <option value="ETH-USDT">ETH / USDT</option>
              <option value="SOL-USDT">SOL / USDT</option>
            </select>
          </div>
          
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">EXCHANGE</label>
            <div className="w-full bg-[#181a24] border border-blue-600/50 rounded px-3 py-2 text-sm text-blue-400">Blofin (Connected Live)</div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">MARGIN MODE</label>
            <select className="w-full bg-[#181a24] border border-gray-700 rounded px-3 py-2 text-sm" value={marginMode} onChange={(e) => setMarginMode(e.target.value)}>
              <option>Isolated</option>
              <option>Cross</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">SINGLE TIMEFRAME</label>
            <div className="grid grid-cols-6 gap-1">
              {["1m", "5m", "15m", "1H", "4H", "1D"].map(tf => (
                <button key={tf} onClick={() => setSingleTf(tf)} className={`py-1 text-[10px] rounded ${singleTf === tf ? "bg-blue-600" : "bg-[#181a24]"}`}>{tf}</button>
              ))}
            </div>
          </div>

          <button onClick={handleRunAnalysis} className="w-full bg-blue-600 py-3 rounded text-sm font-bold flex justify-center items-center gap-2">
            {isLoading ? <RefreshCw className="animate-spin" /> : <Play size={16} />} RUN ANALYSIS
          </button>
        </div>

        {/* RECHTS: MAIN */}
        <div className="flex-1 bg-[#10121a] border border-gray-800 rounded-xl p-6">
          <TradingViewWidget symbol={asset} />
          
          <div className="flex justify-between items-end mt-4">
            <h2 className="text-2xl font-bold text-blue-500">{asset} <span className="text-gray-500 font-normal">@ BLOFIN ({analysisData.timeframe})</span></h2>
            <div className="text-right">
              <div className="text-[10px] text-orange-500 font-bold uppercase">PROBABILITY</div>
              <div className="text-3xl font-black text-orange-500">{analysisData.probability}%</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6">
            {[{l: "TIMEFRAME", v: analysisData.timeframe}, {l: "POSITION", v: analysisData.position}, {l: "LEVERAGE", v: analysisData.leverage}, {l: "BLOFIN ENTRY", v: `$${analysisData.entry}`}].map(item => (
              <div key={item.l} className="bg-[#161822] p-4 rounded border border-gray-800">
                <div className="text-[9px] text-gray-500 uppercase">{item.l}</div>
                <div className="text-lg font-bold">{item.v}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-[#161822] p-4 rounded border border-red-900/30">
              <div className="text-[9px] text-red-500 uppercase">STOP LOSS</div>
              <div className="text-2xl font-bold text-red-500">${analysisData.stop}</div>
            </div>
            <div className="bg-[#161822] p-4 rounded border border-emerald-900/30">
              <div className="text-[9px] text-emerald-500 uppercase">TAKE PROFIT (TP1)</div>
              <div className="text-2xl font-bold text-emerald-500">${analysisData.tp1}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}