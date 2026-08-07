import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instId = searchParams.get('instId') || 'BTC-USDT';
  const bar = searchParams.get('bar');

  try {
    let multiTfData: Record<string, any> = {};

    if (bar) {
      const res = await fetch(`https://openapi.blofin.com/api/v1/market/candles?instId=${instId}&bar=${bar}&limit=20`);
      const json = await res.json();
      if (json.data) multiTfData[bar] = json.data;
    } else {
      // Multi-TF Scan inkl. 1D und 1W für die KI-Analyse (Limit auf 15 Kerzen reduziert, um Token-Limits zu schonen)
      const timeframes = ['15m', '30m', '1h', '4h', '1d', '1w'];
      for (const tf of timeframes) {
        const res = await fetch(`https://openapi.blofin.com/api/v1/market/candles?instId=${instId}&bar=${tf}&limit=15`);
        const json = await res.json();
        if (json.data) multiTfData[tf] = json.data;
      }
    }

    const prompt = `
    Analysiere die Marktdaten für ${instId}. Daten: ${JSON.stringify(multiTfData)}
    Berücksichtige den übergeordneten Trend (1D & 1W).
    Erstelle eine professionelle Trading-Analyse.
    WICHTIG: Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt. Verwende KEIN Markdown, keine Backticks (\`\`\`), keinen zusätzlichen Text.
    {
      "symbol": "${instId}",
      "exchange": "BloFin",
      "timeframe": "${bar ? bar : "Multi-TF (inkl. 1D/1W)"}",
      "position": "Long",
      "leverage": "10x",
      "livePrice": 64332.6,
      "entry": 64332.6,
      "stopLoss": 63367.61,
      "probability": 72,
      "tpLevels": [
        {"label": "TP1", "price": 65297.59, "prob": 85},
        {"label": "TP2", "price": 66262.58, "prob": 72},
        {"label": "TP3", "price": 67549.23, "prob": 55}
      ],
      "tpReasoning": "Begründung basierend auf Trend-Konfluenz",
      "reasoning": {
        "structure": "Trend-Analyse über 4h/1d/1w",
        "keyLevels": "Support/Resistance",
        "momentum": "RSI & Money Flow",
        "risk": "Risikomanagement"
      },
      "rejections": ["RSI im überkauften Bereich (Vorsicht)", "Volume & Money Flow bewegen sich im Standard-Rahmen"]
    }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const rawText = response.text || "{}";
    
    // Extrahiere reines JSON falls das Modell trotz Verbots Markdown nutzt
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const cleanedJsonString = jsonMatch ? jsonMatch[0] : rawText;

    const parsedData = JSON.parse(cleanedJsonString);

    return NextResponse.json({ code: "0", data: parsedData });
  } catch (error: any) {
    console.error("API /api/blofin Fehler:", error);
    return NextResponse.json({ code: "-1", msg: error.message }, { status: 500 });
  }
}