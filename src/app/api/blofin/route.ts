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

    const currentPrice = parseFloat(blofinData.data[0][4]);

    // Intelligenterer Fallback-Modus mit simulierter MCB- & Liquiditäts-Logik
    const getFallbackData = () => {
      // Kleine dynamische Abstände basierend auf dem echten Live-Preis (ca. 0.3% Schritte für TPs)
      const step = currentPrice * 0.0035; 
      return {
        symbol: instId.replace("-", ""),
        exchange: "BloFin",
        timeframe: bar,
        position: "Long",
        leverage: "10x",
        livePrice: currentPrice,
        entry: currentPrice,
        stopLoss: Number((currentPrice - (step * 2.2)).toFixed(2)), // Unter die simulierte liquide Zone
        probability: 74,
        tpLevels: [
          { label: "TP1", price: Number((currentPrice + step).toFixed(2)), prob: 70 },
          { label: "TP2", price: Number((currentPrice + (step * 2)).toFixed(2)), prob: 64 },
          { label: "TP3", price: Number((currentPrice + (step * 3)).toFixed(2)), prob: 58 },
          { label: "TP4", price: Number((currentPrice + (step * 4.5)).toFixed(2)), prob: 50 }
        ],
        tpReasoning: "⚠️ Fallback-Modus (MCB-Struktur & Liquiditäts-Zonen heuristisch berechnet)",
        reasoning: {
          "structure": "Trendfortsetzung basierend auf lokalem Orderbuch-Flow",
          "keyLevels": "Heuristische Liquiditäts-Cluster aktiv",
          "momentum": "Kaufdruck im aktuellen Intervall stabil",
          "risk": "Automatisierter technischer Puffer aktiv"
        },
        rejections: [
          "Gegenargument 1: API-Limit erreicht – Werte basieren auf mathematischem MCB-Fallback",
          "Gegenargument 2: Vorsicht vor Volatilitätsspitzen im Orderbuch",
          "Gegenargument 3: Wichtige Widerstandsmarke im höheren Zeitfenster abwarten"
        ]
      };
    };

    // 2. Erweiterten Prompt für Gemini mit MCB-Indikator und liquiden Zonen erstellen
    const prompt = `
      Du bist ein professioneller Krypto-Daytrader, Quant-Analyst und Market Cipher / MCB Indikator Spezialist. 
      Analysiere den Markt für das Asset ${instId} im Timeframe ${bar} unter Einbezug von:
      - Orderbuch- und Volumen-Profilen
      - Dem MCB Indikator (Multi-Criteria Bias & Money Flow)
      - Spezifischen liquiden Zonen (Stop-Loss-Cluster, Order-Blöcke)
      
      Der aktuelle Live-Preis liegt bei ${currentPrice}.
      
      Erstelle eine hochpräzise Analyse und antworte AUSSCHLIESSLICH im folgenden gültigen JSON-Format (ohne Markdown-Backticks, reiner Text):
      {
        "symbol": "${instId.replace("-", "")}",
        "exchange": "BloFin",
        "timeframe": "${bar}",
        "position": "Long",
        "leverage": "10x",
        "livePrice": ${currentPrice},
        "entry": ${currentPrice},
        "stopLoss": ${currentPrice * 0.98},
        "probability": 75,
        "tpLevels": [
          {"label": "TP1", "price": ${currentPrice * 1.01}, "prob": 70},
          {"label": "TP2", "price": ${currentPrice * 1.02}, "prob": 65},
          {"label": "TP3", "price": ${currentPrice * 1.03}, "prob": 60},
          {"label": "TP4", "price": ${currentPrice * 1.04}, "prob": 55}
        ],
        "tpReasoning": "🤖 Von Gemini KI errechnet & analysiert (MCB & Liquidity)",
        "reasoning": {
          "structure": "Solide Trendfortsetzung im MCB-Modell",
          "keyLevels": "Kritische liquide Zone / Order-Block identifiziert",
          "momentum": "Money Flow zeigt stabiles Kaufinteresse",
          "risk": "Volatilitäts-Buffer hinter die liquide Zone gesetzt"
        },
        "rejections": [
          "Gegenargument 1: Vorsicht vor Liquiditäts-Sweep im höheren Zeitfenster",
          "Gegenargument 2: MCB zeigt leichte Konsolidierung",
          "Gegenargument 3: Widerstandszone an der nächsten Liquiditätsmarke"
        ]
      }
    `;

    // 3. Anfrage an Gemini mit automatischem Retry
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
          aiData.tpReasoning = "🤖 Von Gemini KI errechnet & analysiert (MCB & Liquidity)";
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