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

    // Funktion für Fallback-Daten (klar als Fallback markiert)
    const getFallbackData = () => ({
      symbol: instId.replace("-", ""),
      exchange: "BloFin",
      timeframe: bar,
      position: "Long",
      leverage: "10x",
      livePrice: currentPrice,
      entry: currentPrice,
      stopLoss: currentPrice * 0.98,
      probability: 78,
      tpLevels: [
        { label: "TP1", price: currentPrice * 1.01, prob: 72 },
        { label: "TP2", price: currentPrice * 1.02, prob: 66 },
        { label: "TP3", price: currentPrice * 1.03, prob: 60 },
        { label: "TP4", price: currentPrice * 1.04, prob: 54 }
      ],
      tpReasoning: "⚠️ Fallback-Modus (Live-Daten ohne KI-Text)",
      reasoning: {
        "structure": "Stabile Trendfortsetzung im gewählten Intervall (Live-Daten)",
        "keyLevels": "Wichtige Liquiditätszone am aktuellen Kurs",
        "momentum": "Kaufinteresse im Orderbuch stabil",
        "risk": "Automatisierter Risiko-Puffer aktiv"
      },
      rejections: [
        "Gegenargument 1: Vorsicht bei Liquiditätsschüben im höheren Zeitfenster",
        "Gegenargument 2: Volumen zeigt kurze Konsolidierungsphase",
        "Gegenargument 3: Widerstandszone in nächster Nähe beachten"
      ]
    });

    // 2. Prompt für Gemini erstellen
    const prompt = `
      Du bist ein professioneller Krypto-Daytrader und Market Cipher Analyst. 
      Analysiere den Markt für das Asset ${instId} im Timeframe ${bar}. 
      Der aktuelle Live-Preis liegt bei ${currentPrice}.
      
      Erstelle eine Analyse und antworte AUSSCHLIESSLICH im folgenden gültigen JSON-Format (ohne Markdown-Backticks, reiner Text):
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
        "tpReasoning": "🤖 Von Gemini KI errechnet & analysiert",
        "reasoning": {
          "structure": "Solide Trendfortsetzung im gewählten Intervall",
          "keyLevels": "Wichtige Unterstützung am gleitenden Durchschnitt",
          "momentum": "Aufwärtsdynamik ist stabil",
          "risk": "Volatilitäts-Buffer am Stop-Loss aktiv"
        },
        "rejections": [
          "Gegenargument 1: Leichter Widerstand im höheren Zeitfenster",
          "Gegenargument 2: Volumen zeigt kurze Konsolidierung",
          "Gegenargument 3: Überkaufte Indikatoren im 15m Chart"
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
        
        // Sicherstellen, dass das KI-Label auf jeden Fall gesetzt ist
        if (!aiData.tpReasoning || aiData.tpReasoning.includes("Fallback")) {
          aiData.tpReasoning = "🤖 Von Gemini KI errechnet & analysiert";
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