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
  const bar = searchParams.get("bar") || "4h";

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

    const prompt = `Analysiere diese Marktdaten für ${instId} im ${bar}-Timeframe. Aktueller Preis: ${currentPrice}.
    Antworte ausschließlich im folgenden JSON-Format, ohne jegliche Markdown-Formatierung wie \`\`\`json:
    {
      "symbol": "${instId}",
      "exchange": "BloFin",
      "timeframe": "${bar}",
      "position": "Long",
      "leverage": "10x",
      "livePrice": ${currentPrice},
      "entry": ${currentPrice},
      "stopLoss": ${currentPrice * 0.98},
      "probability": 85,
      "tpLevels": [
        {"label": "TP1", "price": ${currentPrice * 1.02}, "prob": 90},
        {"label": "TP2", "price": ${currentPrice * 1.04}, "prob": 75},
        {"label": "TP3", "price": ${currentPrice * 1.06}, "prob": 60}
      ],
      "tpReasoning": "Konservatives Take-Profit-Szenario",
      "reasoning": {
        "structure": "Starke bullische Marktstruktur im gewählten Intervall.",
        "keyLevels": "Wichtige Liquiditätszone identifiziert.",
        "momentum": "Money Flow zeigt klar nach oben.",
        "risk": "Gesunder Puffer für Risikomanagement gesetzt."
      },
      "rejections": ["Keine negativen Divergenzen", "Volumen bestätigt den Trend"]
    }`;

    // Hilfsfunktion mit automatischem Retry bei Überlastung (503)
    let response;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });
        break; // Wenn erfolgreich, Schleife verlassen
      } catch (err: any) {
        if (err?.status === 503 && attempts < maxAttempts) {
          console.warn(`Gemini überlastet (503), Versuch ${attempts} fehlgeschlagen. Neuer Versuch in 1.5s...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } else {
          throw err; // Anderen Fehler direkt weiterwerfen
        }
      }
    }

    let aiText = response?.text || "{}";
    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsedData = JSON.parse(aiText);

    return NextResponse.json({
      code: "0",
      data: parsedData,
    });

  } catch (error: any) {
    console.error("API FEHLER:", error);
    return NextResponse.json({ code: "500", msg: "Fehler bei der KI-Analyse." }, { status: 500 });
  }
}