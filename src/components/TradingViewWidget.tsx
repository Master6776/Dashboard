"use client";

import React, { useEffect, useRef, memo } from "react";

interface TradingViewWidgetProps {
  symbol: string;
  timeframe?: string;
}

function TradingViewWidget({ symbol, timeframe = "1h" }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";

    const formattedSymbol = `BLOFIN:${symbol.replace("-", "").toUpperCase()}`;

    let tvInterval = "60";
    if (timeframe === "15m") tvInterval = "15";
    else if (timeframe === "30m") tvInterval = "30";
    else if (timeframe === "1h") tvInterval = "60";
    else if (timeframe === "4h") tvInterval = "240";
    else if (timeframe === "1d") tvInterval = "D";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: formattedSymbol,
      interval: tvInterval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "3",
      locale: "de_DE",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    container.current.appendChild(script);
  }, [symbol, timeframe]);

  return (
    <div 
      className="w-full h-[450px] bg-[#1a1d26] rounded-lg overflow-hidden border border-gray-800" 
      ref={container} 
    />
  );
}

export default memo(TradingViewWidget);