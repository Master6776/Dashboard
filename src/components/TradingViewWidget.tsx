"use client";

import React, { useEffect, useRef, memo } from "react";

// 1. TypeScript Interface für die Props definieren
interface TradingViewWidgetProps {
  symbol: string;
  timeframe?: string; // timeframe optional machen
}

// 2. Hilfsfunktion zur Umwandlung des Timeframes für TradingView
const mapTimeframeToInterval = (tf?: string): string => {
  switch (tf) {
    case "1m": return "1";
    case "5m": return "5";
    case "15m": return "15";
    case "1h":
    case "1H": return "60";
    case "4h":
    case "4H": return "240";
    case "1D": return "D";
    default: return "60";
  }
};

function TradingViewWidget({ symbol, timeframe = "1h" }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentContainer = container.current;
    if (!currentContainer) return;

    // Container vor neuem Inject leeren
    currentContainer.innerHTML = "";

    // Ticker für TradingView formatieren (z. B. BTC-USDT -> BLOFIN:BTCUSDT)
    const formattedSymbol = `BLOFIN:${symbol.replace("-", "").toUpperCase()}`;
    const interval = mapTimeframeToInterval(timeframe);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: formattedSymbol,
      interval: interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1", // 1 = Japanische Kerzenständer (Candlesticks)
      locale: "de_DE",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    currentContainer.appendChild(script);

    // Cleanup-Funktion beim Unmounten oder Parameter-Wechsel
    return () => {
      if (currentContainer) {
        currentContainer.innerHTML = "";
      }
    };
  }, [symbol, timeframe]);

  return (
    <div className="w-full h-[450px] bg-[#161822] rounded-lg overflow-hidden border border-gray-800/80 shadow-inner">
      <div className="tradingview-widget-container h-full w-full" ref={container} />
    </div>
  );
}

export default memo(TradingViewWidget);