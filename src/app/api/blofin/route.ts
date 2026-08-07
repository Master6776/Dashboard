import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ==========================================
// 1. REIN ALGORITHMISCHE LOGIK (OHNE KI)
// ==========================================
function calculateDeterministicAnalysis(instId: string, bar: string, currentPrice: number, vmc: any, trends: any) {
  const isBuy = Boolean(vmc.buySignal);
  const isSell = Boolean(vmc.sellSignal);
  const mfiGreen = Boolean(vmc.mfiIsGreen);
  const trend1D = trends['1d'] || 'Neutral';
  const trend1W = trends['1w'] || 'Neutral';

  // Punktesystem für Wahrscheinlichkeit (0 - 100%)
  let score = 50;
  const rejections: string[] = [];

  // Richtung bestimmen
  let position = "Neutral";
  if (isBuy) position = "Long";
  else if (isSell) position = "Short";

  // Konfluenz-Prüfung
  if (position === "Long") {
    if (mfiGreen) { score += 20; } else { rejections.push("MFI ist rot trotz Buy-Signal (schwächt den Inflow ab)"); score -= 15; }
    if (trend1D.toLowerCase().includes('bull') || trend1D.toLowerCase().includes('up')) { score += 15; } else { rejections.push("1D-Trend steht im Widerspruch zum Long-Setup"); score -= 10; }
    if (trend1W.toLowerCase().includes('bull') || trend1W.toLowerCase().includes('up')) { score += 10; }
  } else if (position === "Short") {
    if (!mfiGreen) { score += 20; } else { rejections.push("MFI ist grün trotz Sell-Signal"); score -= 15; }
    if (trend1D.toLowerCase().includes('bear') || trend1D.toLowerCase().includes('down')) { score += 15; } else { rejections.push("1D-Trend steht im Widerspruch zum Short-Setup"); score -= 10; }
    if (trend1W.toLowerCase().includes('bear') || trend1W.toLowerCase().includes('down')) { score += 10; }
  } else {
    score = 30;
    rejections.push("Kein aktives VuManChu Buy- oder Sell-Signal vorhanden.");
  }

  // Begrenzen auf 10% - 95%
  const probability = Math.max(10, Math.min(95, score));

  // Dynamische TP & SL Berechnung basierend auf aktuellem Preis
  const atrEstimate = currentPrice * 0.015; // 1.5% als grobe Volatilitätsbasis
  let stopLoss = 0;
  const tpLevels = [];

  if (position === "Long") {
    stopLoss = parseFloat((currentPrice - (atrEstimate * 1.5)).toFixed(2));
    tpLevels.push(
      { label: "TP1", price: parseFloat((currentPrice + atrEstimate).toFixed(2)), prob: 70 },
      { label: "TP2", price: parseFloat((currentPrice + (atrEstimate * 2)).toFixed(2)), prob: 50 },
      { label: "TP3", price: parseFloat((currentPrice + (atrEstimate * 3.5)).toFixed(2)), prob: 30 }
    );
  } else if (position === "Short") {
    stopLoss = parseFloat((currentPrice + (atrEstimate * 1.5)).toFixed(2));
    tpLevels.push(
      { label: "TP1", price: parseFloat((currentPrice - atrEstimate).toFixed(2)), prob: 70 },
      { label: "TP2", price: parseFloat((currentPrice - (atrEstimate * 2)).toFixed(2)), prob: 50 },
      { label: "TP3", price: parseFloat((currentPrice - (atrEstimate * 3.5)).toFixed(2)), prob: 30 }
    );
  } else {
    stopLoss = parseFloat((currentPrice * 0.98).toFixed(2));
    tpLevels.push(
      { label: "TP1", price: parseFloat((currentPrice * 1.01).toFixed(2)), prob: 50 },
      { label: "TP2", price: parseFloat((currentPrice * 1.02).toFixed(2)), prob: 40 },
      { label: "TP3", price: parseFloat((currentPrice * 1.03).toFixed(2)), prob: 20 }
    );
  }

  return {
    symbol: instId,
    exchange: "BloFin (Algorithmisch)",
    timeframe: bar,
    position: position,
    leverage: "10x",
    livePrice: currentPrice,
    entry: currentPrice,
    stopLoss: stopLoss,
    probability: probability,
    tpLevels: tpLevels,
    tpReasoning: `Rein mathematisches Setup berechnet via WaveTrend (WT1: ${vmc.wt1 || 0}, WT2: ${vmc.wt2 || 0}) und MFI (${mfiGreen ? 'Inflow' : 'Outflow'}).`,
    reasoning: {
      structure: `Marktstruktur im ${bar} TF zeigt ${position !== 'Neutral' ? 'Momentum-Ausbruch' : 'Konsolidierung'}. Trend 1D: ${trend1D}.`,
      keyLevels: `Einstieg direkt am aktuellen Marktpreis (${currentPrice}). ATR-basiertes Risk-Management aktiv.`,
      momentum: `WaveTrend WT1 (${vmc.wt1 || 0}) kreuzt WT2 (${vmc.wt2 || 0}). MFI Status: ${mfiGreen ? 'Grün (Bullisch)' : 'Rot ( Bärisch)'}.`,
      risk: `Chance-Risiko-Verhältnis skaliert über 3 Take-Profit-Stufen. Stop-Loss abgesichert.`
    },
    rejections: rejections.length > 0 ? rejections : ["Keine wesentlichen Ablehnungen – Konfluenz ist gegeben."]
  };
}

// ==========================================
// 2. API ROUTE HANDLER
// ==========================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { instId = 'BTC-USDT', bar = '4h', indicators = {}, useAI = true } = body;

    // Live-Kerzen von BloFin laden
    const response = await fetch(`https://openapi.blofin.com/api/v1/market/candles?instId=${instId}&bar=${bar}&limit=50`);
    const json = await response.json();
    const candles = json.data || [];
    const currentPrice = candles.length > 0 ? parseFloat(candles[0][4]) : 0;

    const vmc = indicators?.vuManChu || {};
    const trends = indicators?.trend || {};

    // WENN useAI auf false steht ODER kein API-Key da ist -> Sofort rein algorithmisch antworten!
    if (!useAI || !process.env.GEMINI_API_KEY) {
      const algoResult = calculateDeterministicAnalysis(instId, bar, currentPrice, vmc, trends);
      return NextResponse.json({ code: "0", mode: "algorithmic", data: algoResult });
    }

    // ANSONSTEN: KI-GESTÜTZTE ANALYSE (GEMINI)
    const prompt = `
      Du bist ein professioneller Krypto-Algorithmus und Trader. Analysiere folgendes Setup basierend auf harten technischen Indikatoren:
      - Instrument: ${instId}
      - Timeframe: ${bar}
      - Aktueller Preis: ${currentPrice}
      
      Live Indikatoren (VuManChu Cipher B & MFI & Trend):
      - VuManChu Buy-Signal aktiv: ${vmc.buySignal ? 'JA' : 'NEIN'}
      - VuManChu Sell-Signal aktiv: ${vmc.sellSignal ? 'JA' : 'NEIN'}
      - Money Flow (MFI) Inflow (Grün): ${vmc.mfiIsGreen ? 'JA' : 'NEIN'}
      - WaveTrend Werte: WT1 = ${vmc.wt1 || 0}, WT2 = ${vmc.wt2 || 0}
      - Übergeordnete Trends: 1D = ${trends['1d'] || 'Unbekannt'}, 1W = ${trends['1w'] || 'Unbekannt'}

      STRENGE REGELN:
      - Vergib eine realistische Wahrscheinlichkeit (probability) zwischen 10% und 95%.
      - Wenn Indikatoren sich widersprechen, setze die probability unter 50 und liste die Gründe in "rejections" auf.

      Gib Deine Analyse EXAKT als valides JSON-Objekt zurück (ohne Markdown-Bloecke, ohne Erklärungen drumherum), mit exakt folgender Struktur:
      {
        "symbol": "${instId}",
        "exchange": "BloFin",
        "timeframe": "${bar}",
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

    let text = aiResponse.text;
    if (!text) {
      throw new Error("Keine Antwort von Gemini erhalten.");
    }

    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const resultJson = JSON.parse(text);

    return NextResponse.json({ code: "0", mode: "ai", data: resultJson });

  } catch (error: any) {
    console.error("API-Fehler, wechsle auf Fallback-Algorithmus:", error);
    
    // Falls die KI ausfällt (z.B. Rate Limit oder Netzwerkfehler), automatisch auf den deterministischen Modus zurückfallen!
    try {
      const body = await req.json().catch(() => ({}));
      const instId = body.instId || 'BTC-USDT';
      const bar = body.bar || '4h';
      const fallbackPrice = 60000; // Notfall-Fallback
      const algoResult = calculateDeterministicAnalysis(instId, bar, fallbackPrice, body.indicators?.vuManChu || {}, body.indicators?.trend || {});
      return NextResponse.json({ code: "0", mode: "fallback_after_error", data: algoResult });
    } catch (innerError) {
      return NextResponse.json({ code: "1", msg: error.message }, { status: 500 });
    }
  }
}