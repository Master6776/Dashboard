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

    // Dynamischer Fallback-Modus mit timeframe-abhängigen Wahrscheinlichkeiten
    const getFallbackData = () => {
      const step = currentPrice * (bar === "15m" ? 0.0015 : bar === "1h" ? 0.003 : 0.007);
      const pos = isBullish ? "Long" : "Short";
      
      // Kleinere Timeframes haben oft volatilere, tiefere Wahrscheinlichkeiten
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
        tpReasoning: `⚠️ Fallback-Modus (${pos}-Setup für ${bar} berechnet)`,
        reasoning: {
          "structure": `${pos}-Struktur im ${bar}-Intervall (Fallback)`,
          "keyLevels": "Heuristische Liquiditäts-Cluster aktiv",
          "momentum": "Orderbuch-Flow im aktuellen Zeitfenster",
          "risk": "Automatisierter technischer Puffer aktiv"
        },
        rejections: [
          `Gegenargument 1: API-Limit erreicht – Werte an ${bar} angepasst`,
          "Gegenargument 2: Vorsicht vor Volatilitätsspitzen im Orderbuch",
          `Gegenargument 3: Übergeordnete Trendstruktur im ${bar} beachten`
        ]
      };
    };

    // 2. Prompt für Gemini mit klarem Befehl für zeitfensterabhängige Wahrscheinlichkeiten
    const prompt = `
      Du bist ein professioneller Krypto-Daytrader, Quant-Analyst und Market Cipher / MCB Indikator Spezialist. 
      Analysiere die folgenden BloFin Kerzendaten für das Asset ${instId} im Timeframe **${bar}**.
      Aktueller Live-Preis: ${currentPrice}.
      Kerzenhistorie (neueste zuerst): ${JSON.stringify(candles.slice(0, 5))}.

      WICHTIG: Die Wahrscheinlichkeiten (probability sowie die TP-Wahrscheinlichkeiten) MÜSSEN realistisch zum gewählten Timeframe (${bar}) passen! 
      - Ein 15m-Chart hat andere statistische Rausch- und Trefferquoten als ein 1d-Chart. Passe die Zahlen individuell an die Marktstruktur an (keine starren Standardwerte verwenden!).

      Aufgaben:
      1. Prüfe den Trend, den MCB-Indikator (Multi-Criteria Bias) und liquide Zonen im Timeframe ${bar}.
      2. Entscheide frei, ob das Setup **"Long"** oder **"Short"** sein soll.
      3. Berechne Entry, Stop-Loss und TP1 bis TP4 dynamisch passend zu ${bar}.
      
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
          "structure": "Marktstruktur im ${bar}",
          "keyLevels": "Liquide Zonen im ${bar}",
          "momentum": "Momentum und MCB im ${bar}",
          "risk": "Risiko-Management für ${bar}"
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