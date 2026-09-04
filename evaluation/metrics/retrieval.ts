/**
 * Calculates Precision@K
 * Precision@K = (Relevant retrieved results) / K
 */
export function calculatePrecisionAtK(retrieved: string[], relevant: string[], k: number): number {
  if (k === 0) return 0;
  
  const topK = retrieved.slice(0, k);
  let relevantCount = 0;
  for (const result of topK) {
    if (relevant.includes(result)) {
      relevantCount++;
    }
  }
  return relevantCount / k;
}

/**
 * Calculates Recall@K
 * Recall@K = (Relevant retrieved results) / (Total relevant results)
 */
export function calculateRecallAtK(retrieved: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 1; // If there are no relevant items to retrieve, recall is technically perfect.
  
  const topK = retrieved.slice(0, k);
  let relevantCount = 0;
  for (const result of topK) {
    if (relevant.includes(result)) {
      relevantCount++;
    }
  }
  return relevantCount / relevant.length;
}

/**
 * Calculates Mean Reciprocal Rank (MRR)
 * MRR = 1 / (rank of first relevant result), or 0 if none found.
 */
export function calculateMRR(retrieved: string[], relevant: string[]): number {
  if (relevant.length === 0) return 0;

  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.includes(retrieved[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Calculates Normalized Discounted Cumulative Gain (NDCG) given graded relevances.
 * In this simple case, we assume binary relevance (1 if in relevant array, 0 if not).
 */
export function calculateNDCG(retrieved: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 0;
  
  const topK = retrieved.slice(0, k);
  
  // Calculate DCG
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const rel = relevant.includes(topK[i]) ? 1 : 0;
    // DCG = sum(rel / log2(i + 2)) (since i is 0-indexed)
    dcg += rel / Math.log2(i + 2);
  }
  
  // Calculate IDCG (Ideal DCG)
  // The ideal ranking has all relevant items at the top
  let idcg = 0;
  const numRelevantTopK = Math.min(relevant.length, k);
  for (let i = 0; i < numRelevantTopK; i++) {
    idcg += 1 / Math.log2(i + 2);
  }
  
  if (idcg === 0) return 0;
  return dcg / idcg;
}
