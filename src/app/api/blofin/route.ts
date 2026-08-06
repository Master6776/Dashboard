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

    const currentPrice = parseFloat(blofinData.data[0][4]);

    const prompt = `
      Du bist ein professioneller Krypto-Daytrader und Market Cipher Analyst. 
      Analysiere den Markt für das Asset ${instId} im Timeframe ${bar}. 
      Der aktuelle Live-Preis liegt bei ${currentPrice}.
      
      Erstelle eine Analyse und antworte AUSSCHLIESSLICH im folgenden JSON-Format (ohne Markdown-Backticks, reiner Text):
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
        "tpReasoning": "Strukturierte Ziele basierend auf aktuellen Swing-Zonen",
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

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
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

  } catch (error: any) {
    console.error("DETEKTIERTER GEMINI API ERROR:", error?.message || error);
    return NextResponse.json(
      { code: "500", msg: `Fehler: ${error?.message || "Unbekannter Fehler"}` },
      { status: 500 }
    );
  }
}