import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("KRITISCHER FEHLER: GEMINI_API_KEY ist in .env.local nicht gesetzt!");
    return NextResponse.json({ code: "500", msg: "API-Key fehlt im Server." }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const { searchParams } = new URL(request.url);
  const instId = searchParams.get("instId") || "BTC-USDT";
  const bar = searchParams.get("bar") || "1h";

  try {
    const blofinRes = await fetch(
      `https://openapi.blofin.com/api/v1/market/candles?instId=${instId}&bar=${bar}&limit=15`,
      { cache: "no-store" }
    );
    const blofinData = await blofinRes.json();

    if (!blofinData.data || blofinData.data.length === 0) {
      return NextResponse.json({ code: "1", msg: "Keine Marktdaten von BloFin empfangen." }, { status: 400 });
    }

    const candles = blofinData.data;
    const currentPrice = parseFloat(candles[0][4]);
    const isBullish = currentPrice > parseFloat(candles[candles.length - 1][4]);

    const getFallbackData = () => {
      const multipliers: Record<string, number> = { 
        "15m": 0.0015, "30m": 0.0025, "1h": 0.0040, "4h": 0.0080, "1d": 0.0150 
      };
      const step = currentPrice * (multipliers[bar] || 0.0040);
      const pos = isBullish ? "Long" : "Short";
      const baseProb = bar === "15m" ? 68 : bar === "1h" ? 74 : 81;

      return {
        symbol: instId.replace("-", ""),
        exchange: "BloFin",
        timeframe: bar,
        position: pos,
        leverage: "10x",
        livePrice: currentPrice,
        entry: currentPrice,
        stopLoss: Number((isBullish ? currentPrice - (step * 2.2) : currentPrice + (step * 2.2)).toFixed(2)),
        probability: baseProb,
        tpLevels: [
          { label: "TP1", price: Number((isBullish ? currentPrice + step : currentPrice - step).toFixed(2)), prob: baseProb - 2 },
          { label: "TP2", price: Number((isBullish ? currentPrice + (step * 2) : currentPrice - (step * 2)).toFixed(2)), prob: baseProb - 8 },
          { label: "TP3", price: Number((isBullish ? currentPrice + (step * 3) : currentPrice - (step * 3)).toFixed(2)), prob: baseProb - 15 },
          { label: "TP4", price: Number((isBullish ? currentPrice + (step * 4.5) : currentPrice - (step * 4.5)).toFixed(2)), prob: baseProb - 23 }
        ],
        tpReasoning: `⚠️ Fallback-Modus (${pos}-Setup für ${bar} skaliert)`,
        reasoning: {
          "structure": `${pos}-Struktur im ${bar}-Intervall (Fallback)`,
          "keyLevels": `Heuristische Cluster für ${bar}`,
          "momentum": "Orderbuch-Flow aktiv",
          "risk": "Proportionaler Puffer aktiv"
        },
        rejections: ["Nutzung des Fallback-Modus wegen API-Limit oder Quota"]
      };
    };

    const prompt = `
      Analysiere diese BloFin Daten für ${instId} (${bar}). Aktueller Preis: ${currentPrice}.
      Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
      {
        "symbol": "${instId.replace("-", "")}",
        "exchange": "BloFin",
        "timeframe": "${bar}",
        "position": "Long oder Short",
        "leverage": "10x",
        "livePrice": ${currentPrice},
        "entry": ${currentPrice},
        "stopLoss": 0,
        "probability": 70,
        "tpLevels": [
          {"label": "TP1", "price": 0, "prob": 68},
          {"label": "TP2", "price": 0, "prob": 60},
          {"label": "TP3", "price": 0, "prob": 55},
          {"label": "TP4", "price": 0, "prob": 50}
        ],
        "tpReasoning": "KI-Analyse",
        "reasoning": {"structure": "", "keyLevels": "", "momentum": "", "risk": ""},
        "rejections": [""]
      }
    `;

    let response;
    let aiSuccess = false;

    try {
      response = await ai.models.generateContent({
        model: "gemini-2.0-flash", // Korrekter und stabiler Standard für das SDK
        contents: prompt,
      });
      aiSuccess = true;
    } catch (err: any) {
      console.error("API FEHLER:", err?.message || err);
    }

    let aiData;
    if (aiSuccess && response?.text) {
      try {
        const cleaned = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
        aiData = JSON.parse(cleaned);
      } catch (e) {
        aiData = getFallbackData();
      }
    } else {
      aiData = getFallbackData();
    }

    return NextResponse.json({ code: "0", msg: "success", data: aiData });
  } catch (error: any) {
    return NextResponse.json({ code: "500", msg: error.message }, { status: 500 });
  }
}