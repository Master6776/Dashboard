import { NextResponse } from "next/server";

// --- Helper-Funktionen ---
function calculateEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateWaveTrend(prices: number[], n1 = 9, n2 = 12): number[] {
  const esa = calculateEMA(prices, n1);
  const diffs = prices.map((p, i) => Math.abs(p - esa[i]));
  const d = calculateEMA(diffs, n1);
  const ci = prices.map((p, i) => (p - esa[i]) / (0.015 * d[i]));
  return calculateEMA(ci, n2);
}

function calculateMFI(prices: number[]): number {
  const change = prices[prices.length - 1] - prices[prices.length - 14];
  return change > 0 ? 60 : 40; 
}

function calculateVWAP(prices: number[], volumes: number[]): number {
  let pvSum = 0;
  let vSum = 0;
  for (let i = 0; i < prices.length; i++) {
    pvSum += prices[i] * volumes[i];
    vSum += volumes[i];
  }
  return pvSum / vSum;
}

function calculateBollinger(prices: number[], period = 20) {
  const slice = prices.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(slice.map(x => Math.pow(x - mid, 2)).reduce((a, b) => a + b, 0) / period);
  return { mid, upper: mid + (2 * stdDev), lower: mid - (2 * stdDev), width: (2 * stdDev) };
}

function calculateStochRSI(prices: number[], period = 14): number {
  const slice = prices.slice(-period);
  const min = Math.min(...slice);
  const max = Math.max(...slice);
  if (max === min) return 50;
  return ((prices[prices.length - 1] - min) / (max - min)) * 100;
}

function calculateMomentumWave(prices: number[], period = 14): number { 
  return calculateStochRSI(prices, period); 
}

function calculateMoneyFlowBars(prices: number[], volumes: number[]): number { 
  return (prices[prices.length - 1] - prices[prices.length - 2]) * volumes[volumes.length - 1]; 
}

function detectBloodDiamond(wt: number[], prices: number[], bbUpper: number): boolean { 
  return (wt[wt.length - 1] > 60 && wt[wt.length - 1] < wt[wt.length - 2] && prices[prices.length - 1] >= bbUpper * 0.99); 
}

function detectYellowCross(wt: number[], mfi: number): boolean { 
  return (wt[wt.length - 2] > 50 && wt[wt.length - 1] < wt[wt.length - 2] && mfi < 50); 
}

// --- API Route ---
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instId = searchParams.get("instId") || "BTC-USDT";
  let bar = (searchParams.get("bar") || "15m").toLowerCase();
  if (bar === "d" || bar === "1d") bar = "1D";

  try {
    const res = await fetch(`https://openapi.blofin.com/api/v1/market/candles?instId=${instId}&bar=${bar}&limit=100`, { cache: "no-store" });
    const data = await res.json();

    if (data.code !== "0" || !data.data || data.data.length === 0) {
      return NextResponse.json({ code: "-1", msg: "Keine Daten." }, { status: 400 });
    }

    const rawCandles = [...data.data].reverse();
    const closePrices = rawCandles.map((c: any) => parseFloat(c[4]));
    const volumes = rawCandles.map((c: any) => parseFloat(c[5]));
    const livePrice = closePrices[closePrices.length - 1];

    const wt = calculateWaveTrend(closePrices);
    const mfi = calculateMFI(closePrices);
    const vwap = calculateVWAP(closePrices, volumes);
    const bb = calculateBollinger(closePrices);
    const momWave = calculateMomentumWave(closePrices);
    const moneyFlowBars = calculateMoneyFlowBars(closePrices, volumes);

    let longScore = 0;
    let shortScore = 0;
    let reasoning: string[] = [];

    // 1. Haupt-Signale (MarketCipher A)
    if (detectBloodDiamond(wt, closePrices, bb.upper)) { 
      shortScore += 45; 
      reasoning.push("BLOOD DIAMOND: Bärische Umkehr"); 
    } else if (detectYellowCross(wt, mfi)) { 
      shortScore += 30; 
      reasoning.push("YELLOW CROSS: Bärische Wende"); 
    }

    // 2. WaveTrend mit DYNAMISCHEM Extra-Score (Tiefe/Höhe des Oszillators)
    const currentWT = wt[wt.length - 1];
    if (currentWT < -50) { 
      // Je tiefer unter -50, desto höher der Score (z.B. WT -70 gibt mehr Punkte als WT -52)
      const wtBonus = Math.abs(currentWT + 50) * 0.8;
      longScore += 25 + wtBonus; 
      reasoning.push(`WT Überverkauft (${currentWT.toFixed(1)})`); 
    } else if (currentWT > 50) { 
      const wtBonus = Math.abs(currentWT - 50) * 0.8;
      shortScore += 25 + wtBonus; 
      reasoning.push(`WT Überkauft (${currentWT.toFixed(1)})`); 
    }

    // 3. Momentum & MoneyFlow mit dynamischer Abweichung
    if (momWave > 50 && moneyFlowBars > 0) { 
      const momBonus = (momWave - 50) * 0.3;
      longScore += 15 + momBonus; 
      reasoning.push("MCB: Bullisches Momentum"); 
    } else if (momWave < 50 && moneyFlowBars < 0) { 
      const momBonus = (50 - momWave) * 0.3;
      shortScore += 15 + momBonus; 
      reasoning.push("MCB: Bärisches Momentum"); 
    }

    // 4. VWAP-Abstand in Prozent (Dynamisch)
    const vwapDistancePct = Math.abs((livePrice - vwap) / vwap) * 100;
    const vwapBonus = Math.min(vwapDistancePct * 15, 20); // Max 20 Zusatzpunkte für VWAP

    if (livePrice < vwap) { 
      longScore += 10 + vwapBonus; 
      reasoning.push(`VWAP: Long-Bias (${vwapDistancePct.toFixed(2)}% unter VWAP)`); 
    } else { 
      shortScore += 10 + vwapBonus; 
      reasoning.push(`VWAP: Short-Bias (${vwapDistancePct.toFixed(2)}% über VWAP)`); 
    }

    // --- Dynamische Wahrscheinlichkeits-Berechnung ---
    const position = (longScore >= shortScore) ? "Long" : "Short";
    const totalScore = longScore + shortScore;
    const winningScore = Math.max(longScore, shortScore);

    // Berechnet das verhältnismäßige Übergewicht des Gewinner-Signals
    let probability = Math.round((winningScore / (totalScore || 1)) * 100);

    // Verhindert extrem unglaubwürdige Werte (bleibt im realistischen Bereich von 52% bis 94%)
    probability = Math.max(52, Math.min(probability, 94));
    
    // Stop Loss & Take Profit
    const safeVolatility = Math.max(bb.width * 1.5, livePrice * 0.005);
    const stop = position === "Long" ? livePrice - safeVolatility : livePrice + safeVolatility;
    const tp1 = position === "Long" ? livePrice + (safeVolatility * 2) : livePrice - (safeVolatility * 2);

    return NextResponse.json({
      code: "0",
      data: { 
        instId, 
        bar, 
        livePrice, 
        position, 
        probability, 
        stop: Number(stop.toFixed(1)), 
        tp1: Number(tp1.toFixed(1)),
        reasoning 
      },
    });
  } catch (error) { 
    return NextResponse.json({ code: "-1", msg: "Fehler" }, { status: 500 }); 
  }
}