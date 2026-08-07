import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { instId, bar, indicators, multiTf } = body;

    // Aktuelle Kerzen von BloFin laden, um der KI echte Preisdaten zu geben
    const response = await fetch(`https://openapi.blofin.com/api/v1/market/candles?instId=${instId || 'BTC-USDT'}&bar=${bar || '4h'}&limit=50`);
    const json = await response.json();
    const candles = json.data || [];
    const currentPrice = candles.length > 0 ? parseFloat(candles[0][4]) : 0;

    // Indikatoren aufbereiten für den Prompt
    const vmc = indicators?.vuManChu || {};
    const trends = indicators?.trend || {};

    const prompt = `
      Du bist ein professioneller Krypto-Algorithmus und Trader. Analysiere folgendes Setup basierend auf harten technischen Indikatoren:
      - Instrument: ${instId}
      - Timeframe: ${bar || 'Multi-TF'}
      - Aktueller Preis: ${currentPrice}
      
      Live Indikatoren (VuManChu Cipher B & MFI & Trend):
      - VuManChu Buy-Signal aktiv: ${vmc.buySignal ? 'JA' : 'NEIN'}
      - VuManChu Sell-Signal aktiv: ${vmc.sellSignal ? 'JA' : 'NEIN'}
      - Money Flow (MFI) Inflow (Grün): ${vmc.mfiIsGreen ? 'JA' : 'NEIN'}
      - WaveTrend Werte: WT1 = ${vmc.wt1 || 0}, WT2 = ${vmc.wt2 || 0}
      - Übergeordnete Trends: 1D = ${trends['1d'] || 'Unbekannt'}, 1W = ${trends['1w'] || 'Unbekannt'}

      Gib Deine Analyse EXAKT als valides JSON-Objekt zurück (ohne Markdown-Bloecke, ohne Erklärungen drumherum), mit exakt folgender Struktur:
      {
        "symbol": "${instId}",
        "exchange": "BloFin",
        "timeframe": "${bar || '4h'}",
        "position": "Long",
        "leverage": "10x",
        "livePrice": ${currentPrice},
        "entry": ${currentPrice},
        "stopLoss": 0,
        "probability": 50,
        "tpLevels": [
          {"label": "TP1", "price": 0, "prob": 60},
          {"label": "TP2", "price": 0, "prob": 50},
          {"label": "TP3", "price": 0, "prob": 30}
        ],
        "tpReasoning": "Begründung basierend auf VuManChu und MFI",
        "reasoning": {
          "structure": "Text zur Marktstruktur",
          "keyLevels": "Text zu Key Levels",
          "momentum": "Text zum Momentum",
          "risk": "Text zum Risk Management"
        },
        "rejections": ["Punkt 1", "Punkt 2"]
      }
    `;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    // Korrigiert: .text ist eine Eigenschaft, keine Funktion ()
    let text = aiResponse.text; 
    if (!text) {
      throw new Error("Keine Antwort von Gemini erhalten.");
    }

    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const resultJson = JSON.parse(text);

    return NextResponse.json({ code: "0", data: resultJson });
  } catch (error: any) {
    console.error("KI-Fehler:", error);
    return NextResponse.json({ code: "1", msg: error.message }, { status: 500 });
  }
}