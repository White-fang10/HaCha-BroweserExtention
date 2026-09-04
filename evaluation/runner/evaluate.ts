import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateCER, calculateWER, aggregateOCRMetrics, OCRResult } from '../metrics/ocr.js';
import { ClassificationPrediction, calculateAccuracy, calculateMacroF1, generateConfusionMatrix, calculateECE, Verdict } from '../metrics/classification.js';
import { calculatePrecisionAtK, calculateRecallAtK, calculateMRR } from '../metrics/retrieval.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATASET_DIR = path.join(__dirname, '..', 'dataset');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

async function evaluateOCR() {
  const ocrDataRaw = await fs.readFile(path.join(DATASET_DIR, 'ocr-v1.json'), 'utf-8');
  const ocrData = JSON.parse(ocrDataRaw);
  
  const results: OCRResult[] = [];
  
  for (const sample of ocrData.samples) {
    // In a real scenario, this would call Tesseract.
    // For testing the harness, we simulate a slightly noisy extraction.
    const actualText = sample.expected_text.replace(/a/g, 'e').replace(/1/g, 'l');
    
    results.push({
      id: sample.id,
      category: sample.category,
      expectedText: sample.expected_text,
      actualText,
      cer: calculateCER(sample.expected_text, actualText),
      wer: calculateWER(sample.expected_text, actualText),
    });
  }
  
  const aggregated = aggregateOCRMetrics(results);
  
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(REPORTS_DIR, 'raw-ocr-results.json'), 
    JSON.stringify({ raw: results, aggregated }, null, 2)
  );
  console.log(`Saved OCR metrics to reports/raw-ocr-results.json`);
}

async function evaluateClaims() {
  const claimsDataRaw = await fs.readFile(path.join(DATASET_DIR, 'claims-v1.json'), 'utf-8');
  const claimsData = JSON.parse(claimsDataRaw);
  
  const classificationResults: ClassificationPrediction[] = [];
  
  // Retrieval mock metrics storage
  let mrrSum = 0;
  let p5Sum = 0;
  
  for (const claim of claimsData.claims) {
    // Mock the backend prediction
    // We'll give it an ~80% chance to be correct for the sake of interesting metrics
    const isCorrect = Math.random() > 0.2;
    const allLabels: Verdict[] = ['SUPPORTED', 'FALSE', 'MISLEADING', 'UNVERIFIED'];
    let predicted = claim.label;
    if (!isCorrect) {
      const otherLabels = allLabels.filter(l => l !== claim.label);
      predicted = otherLabels[Math.floor(Math.random() * otherLabels.length)];
    }
    
    // Confidence is higher when correct
    const confidence = isCorrect ? 0.7 + (Math.random() * 0.3) : 0.4 + (Math.random() * 0.4);
    
    classificationResults.push({
      id: claim.id,
      actual: claim.label,
      predicted,
      confidence
    });
    
    // Mock retrieval: assume we retrieved some URLs.
    const relevantUrls = claim.reference_sources.map((s: any) => s.url);
    const retrievedUrls = isCorrect 
      ? [relevantUrls[0], "https://random-site.com", "https://another.org"] 
      : ["https://wrong-site.com", "https://unrelated.com"];
      
    mrrSum += calculateMRR(retrievedUrls, relevantUrls);
    p5Sum += calculatePrecisionAtK(retrievedUrls, relevantUrls, 5);
  }
  
  const accuracy = calculateAccuracy(classificationResults);
  const macroF1 = calculateMacroF1(classificationResults);
  const confusionMatrix = generateConfusionMatrix(classificationResults);
  const ece = calculateECE(classificationResults);
  
  const numClaims = claimsData.claims.length;
  const retrievalMetrics = {
    mrr: mrrSum / numClaims,
    precisionAt5: p5Sum / numClaims,
  };
  
  const finalResults = {
    classification: {
      accuracy,
      macroF1,
      ece,
      confusionMatrix
    },
    retrieval: retrievalMetrics,
    rawPredictions: classificationResults
  };
  
  await fs.writeFile(
    path.join(REPORTS_DIR, 'raw-eval-results.json'), 
    JSON.stringify(finalResults, null, 2)
  );
  console.log(`Saved evaluation metrics to reports/raw-eval-results.json`);
}

async function main() {
  console.log('Starting Evaluation Harness...');
  await evaluateOCR();
  await evaluateClaims();
  console.log('Evaluation Complete.');
}

main().catch(console.error);
