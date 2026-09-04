export type Verdict = 'SUPPORTED' | 'FALSE' | 'MISLEADING' | 'UNVERIFIED';

export interface ClassificationPrediction {
  id: string;
  actual: Verdict;
  predicted: Verdict;
  confidence: number;
}

/**
 * Calculates generic Accuracy
 */
export function calculateAccuracy(predictions: ClassificationPrediction[]): number {
  if (predictions.length === 0) return 0;
  let correct = 0;
  for (const p of predictions) {
    if (p.actual === p.predicted) {
      correct++;
    }
  }
  return correct / predictions.length;
}

/**
 * Calculates Precision for a specific class
 */
export function calculatePrecision(predictions: ClassificationPrediction[], targetClass: Verdict): number {
  let truePositives = 0;
  let falsePositives = 0;
  
  for (const p of predictions) {
    if (p.predicted === targetClass) {
      if (p.actual === targetClass) {
        truePositives++;
      } else {
        falsePositives++;
      }
    }
  }
  
  if (truePositives + falsePositives === 0) return 0;
  return truePositives / (truePositives + falsePositives);
}

/**
 * Calculates Recall for a specific class
 */
export function calculateRecall(predictions: ClassificationPrediction[], targetClass: Verdict): number {
  let truePositives = 0;
  let falseNegatives = 0;
  
  for (const p of predictions) {
    if (p.actual === targetClass) {
      if (p.predicted === targetClass) {
        truePositives++;
      } else {
        falseNegatives++;
      }
    }
  }
  
  if (truePositives + falseNegatives === 0) return 0;
  return truePositives / (truePositives + falseNegatives);
}

/**
 * Calculates F1 Score for a specific class
 */
export function calculateF1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return 2 * (precision * recall) / (precision + recall);
}

/**
 * Calculates Macro F1 across all classes
 */
export function calculateMacroF1(predictions: ClassificationPrediction[]): number {
  const classes: Verdict[] = ['SUPPORTED', 'FALSE', 'MISLEADING', 'UNVERIFIED'];
  let totalF1 = 0;
  
  for (const c of classes) {
    const p = calculatePrecision(predictions, c);
    const r = calculateRecall(predictions, c);
    totalF1 += calculateF1(p, r);
  }
  
  return totalF1 / classes.length;
}

export type ConfusionMatrix = Record<Verdict, Record<Verdict, number>>;

/**
 * Generates a Confusion Matrix
 */
export function generateConfusionMatrix(predictions: ClassificationPrediction[]): ConfusionMatrix {
  const classes: Verdict[] = ['SUPPORTED', 'FALSE', 'MISLEADING', 'UNVERIFIED'];
  const matrix: any = {};
  
  for (const actual of classes) {
    matrix[actual] = {};
    for (const predicted of classes) {
      matrix[actual][predicted] = 0;
    }
  }
  
  for (const p of predictions) {
    if (matrix[p.actual] !== undefined && matrix[p.actual][p.predicted] !== undefined) {
      matrix[p.actual][p.predicted]++;
    }
  }
  
  return matrix as ConfusionMatrix;
}

/**
 * Calculates Expected Calibration Error (ECE)
 * ECE = sum_m( |B_m|/n * |acc(B_m) - conf(B_m)| )
 * We use 10 bins: [0, 0.1), [0.1, 0.2), ... [0.9, 1.0]
 */
export function calculateECE(predictions: ClassificationPrediction[]): number {
  if (predictions.length === 0) return 0;
  
  const numBins = 10;
  const bins: { count: number; correct: number; totalConf: number }[] = Array.from({ length: numBins }, () => ({
    count: 0,
    correct: 0,
    totalConf: 0,
  }));
  
  for (const p of predictions) {
    // Confidence should be [0, 1]
    let binIndex = Math.floor(p.confidence * numBins);
    if (binIndex >= numBins) binIndex = numBins - 1; // handle conf = 1.0
    if (binIndex < 0) binIndex = 0;
    
    bins[binIndex].count++;
    bins[binIndex].totalConf += p.confidence;
    if (p.actual === p.predicted) {
      bins[binIndex].correct++;
    }
  }
  
  let ece = 0;
  for (const bin of bins) {
    if (bin.count > 0) {
      const binAcc = bin.correct / bin.count;
      const binConf = bin.totalConf / bin.count;
      ece += (bin.count / predictions.length) * Math.abs(binAcc - binConf);
    }
  }
  
  return ece;
}
