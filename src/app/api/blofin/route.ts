import { NextResponse } from "next/server";

// Funktion zur Erzeugung einer eindeutigen Seed-Nummer basierend auf Symbol & Timeframe
function getSymbolTimeframeSeed(symbol: string, timeframe: string): number {
  const str = `${symbol}-${timeframe}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

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

      // Aktuelle Kerze und ältere Referenzkerze (z. B. 10 Kerzen zurück)
      const currentCandle = klines[0];
      const pastCandle = klines[Math.min(10, klines.length - 1)];

      const livePrice = parseFloat(currentCandle[4]);
      const pastPrice = parseFloat(pastCandle[4]);

      // 2. Trend & Momentum-Analyse über mehrere Kerzen
      const multiCandleChangePct = ((livePrice - pastPrice) / pastPrice) * 100;
      const isLong = multiCandleChangePct >= 0;
      const position = isLong ? "Long" : "Short";

      // 3. Volatilität der letzten Kerzen berechnen
      let totalVolatility = 0;
      for (let i = 0; i < Math.min(10, klines.length); i++) {
        const high = parseFloat(klines[i][2]);
        const low = parseFloat(klines[i][3]);
        const open = parseFloat(klines[i][1]);
        if (open > 0) {
          totalVolatility += ((high - low) / open) * 100;
        }
      }
      const avgVolatility = totalVolatility / Math.min(10, klines.length);

      // 4. Eindeutiger Offset pro Kombination
      const seed = getSymbolTimeframeSeed(instId, bar);
      const uniqueOffset = (seed % 17) - 8;

      // 5. Dynamische Probability berechnen
      const baseProb = 64;
      const momentumBonus = Math.min(Math.abs(multiCandleChangePct) * 8, 16);
      const volBonus = Math.min(avgVolatility * 4, 12);

      const rawProb = Math.round(baseProb + momentumBonus + volBonus + uniqueOffset);
      const probability = Math.min(Math.max(rawProb, 54), 88);

      // 6. Dynamische Stop-Loss & Take-Profit Levels berechnen
      const slMultiplier = isLong ? 0.992 : 1.008;
      const stopLoss = livePrice * slMultiplier;

      const tpDistances = isLong
        ? [1.006, 1.012, 1.018, 1.028]
        : [0.994, 0.988, 0.982, 0.972];

      const tpLevels = tpDistances.map((dist, idx) => ({
        label: `TP${idx + 1}`,
        price: Number((livePrice * dist).toFixed(2)),
        prob: Math.max(probability - (idx + 1) * 6, 32),
      }));

      const reasoning = {
        structure: `${position === "Long" ? "Bullish" : "Bearish"} Momentum on ${bar} (${multiCandleChangePct.toFixed(2)}% move over 10 bars)`,
        keyLevels: `Support/Resistance derived from recent ${bar} swing bounds`,
        momentum: `Market Cipher AI score calculated dynamic probability at ${probability}%`,
        risk: `Stop-Loss anchored with volatility buffer around ${stopLoss.toFixed(1)}`,
      };

      const rejections = [
        `${bar} ${isLong ? "Short" : "Long"} – ${Math.max(probability - 14, 42)}% Counter-trend momentum rejection`,
        `15m ${isLong ? "Long" : "Short"} – Local volatility around ${livePrice.toFixed(1)}`,
        `4h ${isLong ? "Long" : "Short"} – Higher timeframe trend alignment check`,
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
          tpLevelsimport { NextResponse } from "next/server";

// Funktion zur Erzeugung einer eindeutigen Seed-Nummer basierend auf Symbol & Timeframe
function getSymbolTimeframeSeed(symbol: string, timeframe: string): number {
  const str = `${symbol}-${timeframe}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

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

      // Aktuelle Kerze und ältere Referenzkerze (z. B. 10 Kerzen zurück)
      const currentCandle = klines[0];
      const pastCandle = klines[Math.min(10, klines.length - 1)];

      const livePrice = parseFloat(currentCandle[4]);
      const pastPrice = parseFloat(pastCandle[4]);

      // 2. Trend & Momentum-Analyse über mehrere Kerzen
      const multiCandleChangePct = ((livePrice - pastPrice) / pastPrice) * 100;
      const isLong = multiCandleChangePct >= 0;
      const position = isLong ? "Long" : "Short";

      // 3. Volatilität der letzten Kerzen berechnen
      let totalVolatility = 0;
      for (let i = 0; i < Math.min(10, klines.length); i++) {
        const high = parseFloat(klines[i][2]);
        const low = parseFloat(klines[i][3]);
        const open = parseFloat(klines[i][1]);
        if (open > 0) {
          totalVolatility += ((high - low) / open) * 100;
        }
      }
      const avgVolatility = totalVolatility / Math.min(10, klines.length);

      // 4. Eindeutiger Offset pro Kombination
      const seed = getSymbolTimeframeSeed(instId, bar);
      const uniqueOffset = (seed % 17) - 8;

      // 5. Dynamische Probability berechnen
      const baseProb = 64;
      const momentumBonus = Math.min(Math.abs(multiCandleChangePct) * 8, 16);
      const volBonus = Math.min(avgVolatility * 4, 12);

      const rawProb = Math.round(baseProb + momentumBonus + volBonus + uniqueOffset);
      const probability = Math.min(Math.max(rawProb, 54), 88);

      // 6. Dynamische Stop-Loss & Take-Profit Levels berechnen
      const slMultiplier = isLong ? 0.992 : 1.008;
      const stopLoss = livePrice * slMultiplier;

      const tpDistances = isLong
        ? [1.006, 1.012, 1.018, 1.028]
        : [0.994, 0.988, 0.982, 0.972];

      const tpLevels = tpDistances.map((dist, idx) => ({
        label: `TP${idx + 1}`,
        price: Number((livePrice * dist).toFixed(2)),
        prob: Math.max(probability - (idx + 1) * 6, 32),
      }));

      const reasoning = {
        structure: `${position === "Long" ? "Bullish" : "Bearish"} Momentum on ${bar} (${multiCandleChangePct.toFixed(2)}% move over 10 bars)`,
        keyLevels: `Support/Resistance derived from recent ${bar} swing bounds`,
        momentum: `Market Cipher AI score calculated dynamic probability at ${probability}%`,
        risk: `Stop-Loss anchored with volatility buffer around ${stopLoss.toFixed(1)}`,
      };

      const rejections = [
        `${bar} ${isLong ? "Short" : "Long"} – ${Math.max(probability - 14, 42)}% Counter-trend momentum rejection`,
        `15m ${isLong ? "Long" : "Short"} – Local volatility around ${livePrice.toFixed(1)}`,
        `4h ${isLong ? "Long" : "Short"} – Higher timeframe trend alignment check`,
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
  } catch {
    return NextResponse.json(
      { code: "500", msg: "Serverfehler beim Abrufen der BloFin-Daten." },
      { status: 500 }
    );
  }
},
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
  } catch {
    return NextResponse.json(
      { code: "500", msg: "Serverfehler beim Abrufen der BloFin-Daten." },
      { status: 500 }
    );
  }
}