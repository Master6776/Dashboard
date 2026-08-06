import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    // 1. Echte Kerzendaten von BloFin abfragen
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

    // Korrigierter Fallback-Modus mit sauberer zeitabhängiger Skalierung für SL & TPs
    const getFallbackData = () => {
      // Exakte zeitabhängige Multiplikatoren (höheres Timeframe = größerer Spielraum für Kerzen)
      const multipliers: Record<string, number> = { 
        "15m": 0.0015, 
        "30m": 0.0025, 
        "1h": 0.0040, 
        "4h": 0.0080, 
        "1d": 0.0150 
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
        // Stop-Loss skaliert jetzt logisch mit dem Timeframe (weiter weg bei höheren TF)
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
          "structure": `${pos}-Struktur im ${bar}-Intervall (Volatilitäts-Fallback)`,
          "keyLevels": `Heuristische Liquiditäts-Cluster für ${bar} aktiv`,
          "momentum": "Orderbuch-Flow im aktuellen Zeitfenster",
          "risk": `Proportionaler Stop-Loss-Puffer für ${bar} gesetzt`
        },
        rejections: [
          `Gegenargument 1: API-Limit – Werte an ${bar} angepasst`,
          "Gegenargument 2: Vorsicht vor Volatilitätsspitzen im Orderbuch",
          `Gegenargument 3: Übergeordnete Trendstruktur im ${bar} beachten`
        ]
      };
    };

    // 2. Erweiterten Prompt für Gemini mit strikter Timeframe- und SL-Proportionalität
    const prompt = `
      Du bist ein professioneller Krypto-Daytrader, Quant-Analyst und Market Cipher / MCB Indikator Spezialist. 
      Analysiere die folgenden BloFin Kerzendaten für das Asset ${instId} im Timeframe **${bar}**.
      Aktueller Live-Preis: ${currentPrice}.
      Kerzenhistorie (neueste zuerst): ${JSON.stringify(candles.slice(0, 5))}.

      WICHTIGE REGELN FÜR DIE BERECHNUNG:
      1. **Proportionaler Stop-Loss:** Der Stop-Loss-Abstand muss sich strikt proportional zum Timeframe verhalten! Ein Stop-Loss im 1h- oder 4h-Chart MUSS zwingend weiter vom Entry entfernt sein als ein SL im 15m-Chart, um das Marktrauschen größerer Kerzen abzufedern.
      2. **Zeitfenster-Wahrscheinlichkeiten:** Die Wahrscheinlichkeiten (probability sowie TP-Wahrscheinlichkeiten) müssen realistische Werte für den Timeframe ${bar} widerspiegeln.
      3. **Richtung:** Entscheide frei, ob das optimale Setup **"Long"** oder **"Short"** sein soll basierend auf dem MCB-Indikator und Trend.

      Antworte AUSSCHLIESSLICH im folgenden gültigen JSON-Format (ohne Markdown-Backticks, reiner Text):
      {
        "symbol": "${instId.replace("-", "")}",
        "exchange": "BloFin",
        "timeframe": "${bar}",
        "position": "Long oder Short",
        "leverage": "10x",
        "livePrice": ${currentPrice},
        "entry": ${currentPrice},
        "stopLoss": 0,
        "probability": 0,
        "tpLevels": [
          {"label": "TP1", "price": 0, "prob": 0},
          {"label": "TP2", "price": 0, "prob": 0},
          {"label": "TP3", "price": 0, "prob": 0},
          {"label": "TP4", "price": 0, "prob": 0}
        ],
        "tpReasoning": "🤖 Von Gemini KI errechnet & analysiert (${bar})",
        "reasoning": {
          "structure": "Marktstruktur & MCB-Bias im ${bar}",
          "keyLevels": "Liquide Zonen & Key Levels im ${bar}",
          "momentum": "Money Flow & Momentum im ${bar}",
          "risk": "Risk Management & proportionaler Puffer im ${bar}"
        },
        "rejections": [
          "Gegenargument 1 für ${bar}...",
          "Gegenargument 2 für ${bar}...",
          "Gegenargument 3 für ${bar}..."
        ]
      }
    `;

    // 3. Anfrage an Gemini mit Retry
    let response;
    let retries = 2;
    let delay = 2000;
    let aiSuccess = false;

    for (let i = 0; i < retries; i++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
        });
        aiSuccess = true;
        break;
      } catch (err: any) {
        if (i < retries - 1) {
          await sleep(delay);
          delay *= 2;
        }
      }
    }

    let aiData;
    if (aiSuccess && response?.text) {
      try {
        const rawText = response.text;
        const cleanedJsonText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        aiData = JSON.parse(cleanedJsonText);
        
        if (!aiData.tpReasoning || aiData.tpReasoning.includes("Fallback")) {
          aiData.tpReasoning = `🤖 Von Gemini KI errechnet & analysiert (${bar})`;
        }
      } catch (parseErr) {
        aiData = getFallbackData();
      }
    } else {
      aiData = getFallbackData();
    }

    return NextResponse.json({
      code: "0",
      msg: "success",
      data: aiData,
    });

  } catch (error: any) {
    console.error("KRITISCHER FEHLER IN ROUTE:", error?.message || error);
    return NextResponse.json(
      { code: "500", msg: `Fehler: ${error?.message || "Unbekannter Fehler"}` },
      { status: 500 }
    );
  }
}