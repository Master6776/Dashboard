// Hilfsfunktion: Berechnet EMA
export function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let emaArray: number[] = [];
  if (data.length === 0) return emaArray;
  let prevEMA = data[0];
  emaArray.push(prevEMA);

  for (let i = 1; i < data.length; i++) {
    const currentEMA = (data[i] * k) + (prevEMA * (1 - k));
    emaArray.push(currentEMA);
    prevEMA = currentEMA;
  }
  return emaArray;
}

// Hilfsfunktion: Berechnet SMA
export function calculateSMA(data: number[], period: number): number[] {
  let smaArray: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      smaArray.push(data[i]);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      smaArray.push(sum / period);
    }
  }
  return smaArray;
}

// Hilfsfunktion: Berechnet RSI
export function calculateRSI(closes: number[], period: number = 14): number[] {
  let rsiArray: number[] = new Array(closes.length).fill(50);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (i <= period) {
      if (change >= 0) gains += change; else losses -= change;
      if (i === period) {
        let avgGain = gains / period;
        let avgLoss = losses / period;
        let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsiArray[i] = 100 - (100 / (1 + rs));
      }
    } else {
      rsiArray[i] = 50; 
    }
  }
  return rsiArray;
}

// WaveTrend (f_wavetrend aus deinem Pine Script)
export function calculateWaveTrend(hlc3: number[], chlen = 9, avgLen = 13, maLen = 3) {
  const esa = calculateEMA(hlc3, chlen);
  
  const absDiff = hlc3.map((val, i) => Math.abs(val - esa[i]));
  const de = calculateEMA(absDiff, chlen);
  
  const ci = hlc3.map((val, i) => {
    const denom = 0.015 * de[i];
    return denom === 0 ? 0 : (val - esa[i]) / denom;
  });

  const wt1 = calculateEMA(ci, avgLen);
  const wt2 = calculateSMA(wt1, maLen);

  return { wt1, wt2 };
}

// Interfaces für Candlesticks & VuManChu Cipher B inkl. Money Flow
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MoneyFlowResult {
  mfiValues: number[];
  isGreen: boolean;
}

// Berechnet den Money Flow (MFI-Oszillator für Cipher B)
export function calculateMoneyFlow(candles: Candle[], period: number = 60): MoneyFlowResult {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume || 1);

  let mfiValues: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      mfiValues.push(0);
      continue;
    }

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const moneyFlow = closes[j] * volumes[j];
      if (closes[j] > closes[j - 1]) {
        positiveFlow += moneyFlow;
      } else if (closes[j] < closes[j - 1]) {
        negativeFlow += moneyFlow;
      }
    }

    const totalFlow = positiveFlow + negativeFlow;
    const mfi = totalFlow === 0 ? 50 : (positiveFlow / totalFlow) * 100;
    mfiValues.push(mfi - 50); 
  }

  const latestMfi = mfiValues[mfiValues.length - 1] || 0;

  return {
    mfiValues,
    isGreen: latestMfi >= 0
  };
}

export interface VuManChuResult {
  wt1: number;
  wt2: number;
  buySignal: boolean;
  sellSignal: boolean;
  isOverbought: boolean;
  isOversold: boolean;
  mfiValue: number;
  mfiIsGreen: boolean;
}

// Hauptfunktion für VuManChu Cipher B Signale (WaveTrend Crossovers & Money Flow)
export function calculateVuManChu(candles: Candle[]): VuManChuResult[] {
  const wtChannelLen = 9;
  const wtAverageLen = 12;
  const wtMALen = 3;
  const obLevel = 53;
  const osLevel = -53;

  const hlc3 = candles.map(c => (c.high + c.low + c.close) / 3);
  const wt = calculateWaveTrend(hlc3, wtChannelLen, wtAverageLen, wtMALen);
  const wt1 = wt.wt1;
  const wt2 = wt.wt2;

  const moneyFlowData = calculateMoneyFlow(candles, 60);

  const results: VuManChuResult[] = [];

  for (let i = 0; i < candles.length; i++) {
    const curWt1 = wt1[i];
    const curWt2 = wt2[i];
    const prevWt1 = i > 0 ? wt1[i - 1] : curWt1;
    const prevWt2 = i > 0 ? wt2[i - 1] : curWt2;

    const isOverbought = curWt2 >= obLevel;
    const isOversold = curWt2 <= osLevel;

    const wtCrossUp = prevWt1 <= prevWt2 && curWt1 > curWt2;
    const wtCrossDown = prevWt1 >= prevWt2 && curWt1 < curWt2;
    const wtCross = wtCrossUp || wtCrossDown;

    const buySignal = wtCross && wtCrossUp && isOversold;
    const sellSignal = wtCross && wtCrossDown && isOverbought;

    results.push({
      wt1: curWt1,
      wt2: curWt2,
      buySignal,
      sellSignal,
      isOverbought,
      isOversold,
      mfiValue: moneyFlowData.mfiValues[i] || 0,
      mfiIsGreen: moneyFlowData.mfiValues[i] >= 0
    });
  }

  return results;
}

// Hauptfunktion zur Auswertung basierend auf deinem VuManChu Cipher A Skript
export function evaluateCipherASignals(candles: any[]) {
  if (candles.length < 50) {
    return { trend: "Neutral", score: 50, signalName: "Kein Signal", e21: 0, e50: 0, e200: 0 };
  }

  const opens = candles.map((c: any) => parseFloat(c[1]));
  const highs = candles.map((c: any) => parseFloat(c[2]));
  const lows = candles.map((c: any) => parseFloat(c[3]));
  const closes = candles.map((c: any) => parseFloat(c[4]));
  
  const hlc3 = candles.map((c: any) => (parseFloat(c[2]) + parseFloat(c[3]) + parseFloat(c[4])) / 3);

  const ema1Arr = calculateEMA(closes, 5);
  const ema2Arr = calculateEMA(closes, 11);
  const ema8Arr = calculateEMA(closes, 34);

  const idx = closes.length - 1;

  const wt = calculateWaveTrend(hlc3, 9, 13, 3);
  const wt1Val = wt.wt1[idx];
  const wt2Val = wt.wt2[idx];
  const prevWt1 = wt.wt1[idx - 1];
  const prevWt2 = wt.wt2[idx - 1];

  const wtCross = (prevWt1 < prevWt2 && wt1Val >= wt2Val) || (prevWt1 > prevWt2 && wt1Val <= wt2Val);
  const wtCrossDown = (wt2Val - wt1Val) >= 0;

  const redCross = ema1Arr[idx] < ema2Arr[idx] && ema1Arr[idx - 1] >= ema2Arr[idx - 1];
  const redDiamond = wtCross && wtCrossDown;
  const bloodDiamond = redDiamond && redCross;
  
  const rsimfiVal = ((closes[idx] - opens[idx]) / (highs[idx] - lows[idx] || 1)) * 150;
  const yellowCross = redDiamond && wt2Val < 45 && wt2Val > -80 && rsimfiVal < -5;

  const longEma = ema2Arr[idx] > ema8Arr[idx] && ema2Arr[idx - 1] <= ema8Arr[idx - 1];
  const shortEma = ema2Arr[idx] < ema8Arr[idx] && ema2Arr[idx - 1] >= ema8Arr[idx - 1];

  let score = 50;
  let signalName = "Neutraler Trend";
  let trend = "Neutral";

  if (bloodDiamond) {
    score = 92;
    signalName = "🩸 Blood Diamond (Starker Short / Reversal)";
    trend = "Bärisch";
  } else if (yellowCross) {
    score = 88;
    signalName = "🟡 Yellow Cross Signal";
    trend = "Bärisch";
  } else if (redDiamond) {
    score = 75;
    signalName = "🔴 Red Diamond";
    trend = "Bärisch";
  } else if (longEma || wt1Val > wt2Val) {
    score = 70;
    signalName = "🟢 Bullish WaveTrend / EMA Cross";
    trend = "Bullisch";
  } else if (shortEma) {
    score = 65;
    signalName = "🔴 Bearish EMA Cross";
    trend = "Bärisch";
  }

  return {
    trend,
    score,
    signalName,
    e21: ema2Arr[idx],
    e50: ema8Arr[idx],
    e200: closes[idx]
  };
}