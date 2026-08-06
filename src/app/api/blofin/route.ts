import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Gemini Initialisierung mit dem Key aus der .env.local
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function GET(request: Request) {
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

    // 2. Prompt für Google Gemini erstellen
    const prompt = `
      Du bist ein professioneller Krypto-Daytrader und Market Cipher Analyst. 
      Analysiere den Markt für das Asset ${instId} im Timeframe ${bar}. 
      Der aktuelle Live-Preis liegt bei ${currentPrice}.
      
      Erstelle eine Analyse und antworte AUSSCHLIESSLICH im folgenden JSON-Format (ohne Markdown-Backticks wie \`\`\`json, sondern reiner Text):
      {
        "symbol": "${instId.replace("-", "")}",
        "exchange": "BloFin",
        "timeframe": "${bar}",
        "position": "Long oder Short",
        "leverage": "10x",
        "livePrice": ${currentPrice},
        "entry": ${currentPrice},
        "stopLoss": (Zahl: ein logischer Stop-Loss Preis basierend auf dem Trend),
        "probability": (Zahl zwischen 55 und 90 representing Success Probability),
        "tpLevels": [
          {"label": "TP1", "price": (Zahl), "prob": (Zahl)},
          {"label": "TP2", "price": (Zahl), "prob": (Zahl)},
          {"label": "TP3", "price": (Zahl), "prob": (Zahl)},
          {"label": "TP4", "price": (Zahl), "prob": (Zahl)}
        ],
        "tpReasoning": "Kurze Erklärung zu den Take Profits",
        "reasoning": {
          "structure": "Marktstruktur-Analyse von Gemini",
          "keyLevels": "Wichtige Support/Resistance Zonen",
          "momentum": "Momentum-Bewertung",
          "risk": "Risikomanagement-Hinweis"
        },
        "rejections": [
          "Gegenargument 1",
          "Gegenargument 2",
          "Gegenargument 3"
        ]
      }
    `;

    // 3. Gemini Anfrage senden mit dem passenden Modell
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const rawText = response.text || "";
    const cleanedJsonText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const aiData = JSON.parse(cleanedJsonText);

    return NextResponse.json({
      code: "0",
      msg: "success",
      data: aiData,
    });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { code: "500", msg: "Fehler bei der KI-Analyse durch Gemini." },
      { status: 500 }
    );
  }
}