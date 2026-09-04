import levenshtein from 'fast-levenshtein';

/**
 * Calculates Character Error Rate (CER)
 * CER = (Substitutions + Insertions + Deletions) / Reference Characters
 * In practice, Levenshtein distance gives us the min operations.
 */
export function calculateCER(expected: string, actual: string): number {
  if (expected.length === 0) return actual.length === 0 ? 0 : 1;
  const distance = levenshtein.get(expected, actual);
  return distance / expected.length;
}

/**
 * Calculates Word Error Rate (WER)
 * WER = (Substitutions + Insertions + Deletions) / Reference Words
 */
export function calculateWER(expected: string, actual: string): number {
  const expectedWords = expected.split(/\s+/).filter(w => w.length > 0);
  const actualWords = actual.split(/\s+/).filter(w => w.length > 0);
  
  if (expectedWords.length === 0) return actualWords.length === 0 ? 0 : 1;

  // We can compute WER by treating words as characters for Levenshtein distance calculation
  // Alternatively, since fast-levenshtein works on strings, we could map words to unique chars if needed.
  // But a simpler approach for WER in JS without a specialized word-levenshtein library:
  // We'll write a custom dynamic programming array for words.
  
  const d: number[][] = Array(expectedWords.length + 1).fill(null).map(() => Array(actualWords.length + 1).fill(0));
  
  for (let i = 0; i <= expectedWords.length; i++) d[i][0] = i;
  for (let j = 0; j <= actualWords.length; j++) d[0][j] = j;
  
  for (let i = 1; i <= expectedWords.length; i++) {
    for (let j = 1; j <= actualWords.length; j++) {
      if (expectedWords[i - 1] === actualWords[j - 1]) {
        d[i][j] = d[i - 1][j - 1];
      } else {
        d[i][j] = Math.min(
          d[i - 1][j] + 1,    // deletion
          d[i][j - 1] + 1,    // insertion
          d[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  
  const distance = d[expectedWords.length][actualWords.length];
  return distance / expectedWords.length;
}

export interface OCRResult {
  id: string;
  category: string;
  expectedText: string;
  actualText: string;
  cer: number;
  wer: number;
}

export interface OCRCategoricalMetrics {
  category: string;
  averageCER: number;
  averageWER: number;
  count: number;
}

/**
 * Aggregates OCR results by category
 */
export function aggregateOCRMetrics(results: OCRResult[]): OCRCategoricalMetrics[] {
  const map = new Map<string, { totalCER: number, totalWER: number, count: number }>();
  
  for (const r of results) {
    if (!map.has(r.category)) {
      map.set(r.category, { totalCER: 0, totalWER: 0, count: 0 });
    }
    const cat = map.get(r.category)!;
    cat.totalCER += r.cer;
    cat.totalWER += r.wer;
    cat.count += 1;
  }
  
  const metrics: OCRCategoricalMetrics[] = [];
  for (const [category, data] of map.entries()) {
    metrics.push({
      category,
      averageCER: data.totalCER / data.count,
      averageWER: data.totalWER / data.count,
      count: data.count
    });
  }
  
  return metrics.sort((a, b) => a.category.localeCompare(b.category));
}
