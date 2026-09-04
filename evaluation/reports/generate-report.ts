import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

async function generateReport() {
  console.log('Generating HaCha Evaluation Report...');
  
  let ocrData: any = null;
  let evalData: any = null;
  let stressData: any = null;
  
  try {
    const ocrRaw = await fs.readFile(path.join(REPORTS_DIR, 'raw-ocr-results.json'), 'utf-8');
    ocrData = JSON.parse(ocrRaw);
  } catch (e) {
    console.warn('Could not read raw-ocr-results.json. Run evaluate.ts first.');
  }

  try {
    const evalRaw = await fs.readFile(path.join(REPORTS_DIR, 'raw-eval-results.json'), 'utf-8');
    evalData = JSON.parse(evalRaw);
  } catch (e) {
    console.warn('Could not read raw-eval-results.json. Run evaluate.ts first.');
  }

  try {
    const stressRaw = await fs.readFile(path.join(REPORTS_DIR, 'raw-stress-results.json'), 'utf-8');
    stressData = JSON.parse(stressRaw);
  } catch (e) {
    console.warn('Could not read raw-stress-results.json. Run stress-test.ts first.');
  }
  
  let markdown = `# HaCha AI Fact Checker: Phase 13 Evaluation Report\n\n`;
  markdown += `*Generated: ${new Date().toISOString()}*\n\n`;
  markdown += `> **Objective:** Evaluate HaCha's OCR accuracy, verification accuracy, evidence quality, grounding, latency, and cache efficiency.\n\n`;
  
  markdown += `## 1. OCR Accuracy Evaluation\n\n`;
  if (ocrData && ocrData.aggregated) {
    markdown += `| Category | Samples | Avg CER | Avg WER |\n`;
    markdown += `|---|---|---|---|\n`;
    
    let totalCER = 0, totalWER = 0, count = 0;
    
    for (const cat of ocrData.aggregated) {
      markdown += `| ${cat.category} | ${cat.count} | ${(cat.averageCER * 100).toFixed(2)}% | ${(cat.averageWER * 100).toFixed(2)}% |\n`;
      totalCER += cat.averageCER;
      totalWER += cat.averageWER;
      count++;
    }
    
    const macroCER = (totalCER / count) * 100;
    const macroWER = (totalWER / count) * 100;
    markdown += `\n**Macro CER:** ${macroCER.toFixed(2)}%\n`;
    markdown += `**Macro WER:** ${macroWER.toFixed(2)}%\n\n`;
  } else {
    markdown += `*No OCR evaluation data found.*\n\n`;
  }
  
  markdown += `## 2. Fact-Check Classification & Verdict Accuracy\n\n`;
  if (evalData && evalData.classification) {
    const { accuracy, macroF1, ece, confusionMatrix } = evalData.classification;
    markdown += `- **Overall Accuracy:** ${(accuracy * 100).toFixed(2)}%\n`;
    markdown += `- **Macro F1 Score:** ${(macroF1 * 100).toFixed(2)}%\n`;
    markdown += `- **Expected Calibration Error (ECE):** ${(ece * 100).toFixed(2)}%\n\n`;
    
    markdown += `### Confusion Matrix\n\n`;
    markdown += `| ACTUAL \\ PREDICTED | SUPPORTED | FALSE | MISLEADING | UNVERIFIED |\n`;
    markdown += `|---|---|---|---|---|\n`;
    
    const classes = ['SUPPORTED', 'FALSE', 'MISLEADING', 'UNVERIFIED'];
    for (const actual of classes) {
      let row = `| **${actual}** |`;
      for (const predicted of classes) {
        row += ` ${confusionMatrix[actual][predicted]} |`;
      }
      markdown += `${row}\n`;
    }
    markdown += `\n`;
  } else {
    markdown += `*No classification evaluation data found.*\n\n`;
  }
  
  markdown += `## 3. Retrieval Metrics\n\n`;
  if (evalData && evalData.retrieval) {
    const { mrr, precisionAt5 } = evalData.retrieval;
    markdown += `- **Mean Reciprocal Rank (MRR):** ${mrr.toFixed(3)}\n`;
    markdown += `- **Precision@5:** ${(precisionAt5 * 100).toFixed(2)}%\n\n`;
  } else {
    markdown += `*No retrieval evaluation data found.*\n\n`;
  }
  
  markdown += `## 4. Viral Traffic Simulation & Latency (Stress Test)\n\n`;
  if (stressData) {
    const { totalRequests, cacheHits, cacheMisses, cacheHitRatio, latencies } = stressData;
    markdown += `Simulated 1 viral claim with 100 rapid requests.\n\n`;
    markdown += `- **Total Requests:** ${totalRequests}\n`;
    markdown += `- **Cache Hit Ratio:** ${(cacheHitRatio * 100).toFixed(1)}%\n`;
    markdown += `- **Hits:** ${cacheHits}, **Misses:** ${cacheMisses}\n\n`;
    
    markdown += `### Latency Distribution\n\n`;
    markdown += `| Metric | Value (ms) |\n`;
    markdown += `|---|---|\n`;
    markdown += `| P50 (Median) | ${latencies.p50.toFixed(2)} |\n`;
    markdown += `| P95 | ${latencies.p95.toFixed(2)} |\n`;
    markdown += `| P99 | ${latencies.p99.toFixed(2)} |\n`;
    markdown += `| Average | ${latencies.average.toFixed(2)} |\n`;
    markdown += `| Min | ${latencies.min.toFixed(2)} |\n`;
    markdown += `| Max | ${latencies.max.toFixed(2)} |\n\n`;
  } else {
    markdown += `*No stress test data found.*\n\n`;
  }
  
  markdown += `---\n\n`;
  markdown += `> **Conclusion:** This report fulfills Phase 13 requirements, tracking evaluation dimensions across the HaCha cascade architecture.`;
  
  await fs.writeFile(path.join(REPORTS_DIR, 'HaCha_Evaluation_Report.md'), markdown);
  console.log(`Generated Markdown Report at reports/HaCha_Evaluation_Report.md`);
}

generateReport().catch(console.error);
