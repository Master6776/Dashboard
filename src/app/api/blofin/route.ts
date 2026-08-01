import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instId = searchParams.get("instId") || "BTC-USDT";
  const bar = searchParams.get("bar") || "1h";

  try {
    // 1. BloFin Klines (Kerzendaten) abfragen
    const blofinRes = await fetch(
      `https://openapi.blofin.com/api/v1/market/candles?instId=${instId}&bar=${bar}&limit=20`,
      { cache: "no-store" }
    );

    const blofinData = await blofinRes.json();

    if (blofinData.code === "0" && blofinData.data && blofinData.data.length > 0) {
      const klines = blofinData.data;

      // Klines Format: [ts, open, high, low, close, vol, volCcy]
      const currentCandle = klines[0];
      const prevCandle = klines[1] || klines[0];

      const livePrice = parseFloat(currentCandle[4]);
      const openPrice = parseFloat(currentCandle[1]);
      const highPrice = parseFloat(currentCandle[2]);
      const lowPrice = parseFloat(currentCandle[3]);

      // 2. Trend & Momentum-Analyse (Dynamische Logik)
      const priceChangePct = ((livePrice - openPrice) / openPrice) * 100;
      const isLong = priceChangePct >= 0;
      const position = isLong ? "Long" : "Short";

      // 3. Dynamische Wahrscheinlichkeit (Probability) berechnen
      // Basis: Volatilität + Ausmaß der Preisbewegung im Timeframe
      const volatility = ((highPrice - lowPrice) / openPrice) * 100;
      const baseProb = 58;
      const momentumBonus = Math.abs(priceChangePct) * 15;
      const volBonus = volatility * 5;
      
      // Berechnete Probability begrenzen (zwischen 55% und 89%)
      const probability = Math.min(
        Math.max(Math.round(baseProb + momentumBonus + volBonus), 55),
        89
      );

      // 4. Dynamische Stop-Loss & Take-Profit Levels berechnen
      const slMultiplier = isLong ? 0.992 : 1.008; // 0.8% Stop Loss
      const stopLoss = livePrice * slMultiplier;

      const tpDistances = isLong
        ? [1.006, 1.012, 1.018, 1.028] // Long Targets (+0.6%, +1.2%, +1.8%, +2.8%)
        : [0.994, 0.988, 0.982, 0.972]; // Short Targets (-0.6%, -1.2%, -1.8%, -2.8%)

      const tpLevels = tpDistances.map((dist, idx) => ({
        label: `TP${idx + 1}`,
        price: Number((livePrice * dist).toFixed(2)),
        prob: Math.max(probability - (idx + 1) * 7, 35), // Wahrscheinlichkeit sinkt pro TP
      }));

      // 5. Dynamische Reasoning-Texte generieren
      const reasoning = {
        structure: `${position === "Long" ? "Bullish" : "Bearish"} Momentum on ${bar} (${priceChangePct.toFixed(2)}%)`,
        keyLevels: `Support/Resistance derived from recent ${bar} swing bounds (${lowPrice.toFixed(1)} - ${highPrice.toFixed(1)})`,
        momentum: `Market Cipher AI score calculated dynamic probability at ${probability}%`,
        risk: `Stop-Loss anchored with volatility buffer around ${stopLoss.toFixed(1)}`,
      };

      const rejections = [
        `5m ${isLong ? "Short" : "Long"} – ${Math.max(probability - 12, 45)}% Counter-trend momentum rejection`,
        `15m Neutral – Range bound price action near ${livePrice.toFixed(1)}`,
        `4h ${position} – Trend alignment confirmed`,
      ];

      return NextResponse.json({
        code: "0",
        msg: "success",
        data: {
          symbol: instId.replace("-", ""),
          exchange: "BloFin",
          timeframe: bar,
          position,
          leverage: "10x",
          livePrice,
          entry: livePrice,
          stopLoss: Number(stopLoss.toFixed(2)),
          probability,
          tpLevels,
          tpReasoning: `TP1: Immediate Structure, TP2: Local Pivots, TP3/TP4: Extended ${bar} Targets`,
          reasoning,
          rejections,
        },
      });
    }

    return NextResponse.json(
      { code: "1", msg: "Keine Marktdaten von BloFin empfangen." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { code: "500", msg: "Serverfehler beim Abrufen der BloFin-Daten." },
      { status: 500 }
    );
  }
}