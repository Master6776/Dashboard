"use client";

import React, { useEffect, useRef, memo } from "react";

function TradingViewWidget({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = ""; // Container leeren bei Symbolwechsel

    // Ticker für TradingView formatieren (z. B. BTC-USDT -> BLOFIN:BTCUSDT)
    const formattedSymbol = `BLOFIN:${symbol.replace("-", "").toUpperCase()}`;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: formattedSymbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "de_DE",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    container.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="w-full h-[450px] bg-[#1a1d26] rounded-lg overflow-hidden border border-gray-800" ref={container} />
  );
}

export default memo(TradingViewWidget);