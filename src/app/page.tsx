"use client";

import React, { useState } from "react";
import { Play, RefreshCw, BarChart3, Info } from "lucide-react";
import TradingViewWidget from "../components/TradingViewWidget";

// Konfigurierbare Asset-Liste
const SUPPORTED_ASSETS = [
  { label: "BTC / USDT", value: "BTC-USDT" },
  { label: "ETH / USDT", value: "ETH-USDT" },
  { label: "SOL / USDT", value: "SOL-USDT" },
  { label: "XRP / USDT", value: "XRP-USDT" },
];

export default function TradingDashboard() {
  const [asset, setAsset] = useState("BTC-USDT");
  const [marginMode, setMarginMode] = useState("Isolated");
  const [multiTf, setMultiTf] = useState("ALL");
  const [singleTf, setSingleTf] = useState("5m");
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Analyse-Daten initial auf null setzen, um leeren Zustand zu handhaben
  const [analysisData, setAnalysisData] = useState<any>(null);

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/blofin?instId=${asset}&bar=${singleTf}`);
      const json = await res.json();
      
      if (json.code === "0") {
        setAnalysisData(json.data);
      } else {
        setErrorMsg(json.msg || "Fehler beim Abrufen der Daten.");
      }
    } catch (err) {
      setErrorMsg("Verbindungsfehler zur API.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-gray-200 p-6 flex justify-center font-sans">
      <div className="w-full max-w-7xl flex gap-6">
        
        {/* LINKS: SIDEBAR */}
        <div className="w-80 bg-[#10121a] border border-gray-800 rounded-xl p-5 flex flex-col gap-6 h-fit">
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">ASSET AUSWÄHLEN</label>
            <select 
              className="w-full bg-[#181a24] border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 cursor-pointer text-gray-200"
              value={asset} 
              onChange={(e) => setAsset(e.target.value)}
            >
              {SUPPORTED_ASSETS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">EXCHANGE</label>
            <div className="w-full bg-[#181a24] border border-blue-600/50 rounded px-3 py-2 text-sm text-blue-400">Blofin (Live)</div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block">SINGLE TIMEFRAME</label>
            <div className="grid grid-cols-4 gap-1">
              {["1m", "5m", "15m", "1H", "4H", "1D"].map(tf => (
                <button 
                  key={tf} 
                  onClick={() => setSingleTf(tf)} 
                  className={`py-1 text-[10px] rounded transition ${singleTf === tf ? "bg-blue-600 text-white" : "bg-[#181a24] hover:bg-gray-800"}`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleRunAnalysis} 
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded text-sm font-bold flex justify-center items-center gap-2 transition"
          >
            {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />} 
            {isLoading ? "Analysiere..." : "RUN ANALYSIS"}
          </button>
          
          {errorMsg && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}
        </div>

        {/* RECHTS: MAIN DASHBOARD */}
        <div className="flex-1 bg-[#10121a] border border-gray-800 rounded-xl p-6">
          {!analysisData ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
              <BarChart3 size={48} className="opacity-20" />
              <p>Wähle ein Asset und klicke auf "Run Analysis", um zu starten.</p>
            </div>
          ) : (
            <>
              <TradingViewWidget symbol={asset} />
              
              <div className="flex justify-between items-end mt-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">{asset}</h2>
                  <p className="text-gray-500 text-sm">Zeitrahmen: {analysisData.timeframe}</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-orange-500 font-bold uppercase">PROBABILITY</div>
                  <div className="text-3xl font-black text-orange-500">{analysisData.probability}%</div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4 mt-6">
                {[
                  {l: "SIGNAL", v: analysisData.position, color: analysisData.position === "Long" ? "text-emerald-400" : "text-red-400"}, 
                  {l: "ENTRY PRICE", v: `$${analysisData.livePrice || analysisData.entry}`}, 
                  {l: "STOP LOSS", v: `$${analysisData.stop}`}, 
                  {l: "TAKE PROFIT", v: `$${analysisData.tp1}`}
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#161822] p-4 rounded border border-gray-800">
                    <div className="text-[9px] text-gray-500 uppercase">{item.l}</div>
                    <div className={`text-md font-bold ${item.color || "text-white"}`}>{item.v}</div>
                  </div>
                ))}
              </div>

              {/* Reasoning Section */}
              <div className="mt-6 bg-[#161822] p-4 rounded border border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={14} className="text-blue-500" />
                  <h3 className="text-xs text-gray-400 font-bold uppercase">Analyse-Begründung</h3>
                </div>
                <ul className="space-y-2">
                  {analysisData.reasoning.map((reason: string, i: number) => (
                    <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                      <span className="w-1 h-1 bg-blue-500 rounded-full" /> {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}