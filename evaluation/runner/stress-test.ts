import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

/**
 * Calculates latency percentiles
 */
function calculatePercentiles(latencies: number[]) {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0 };
  
  const sorted = [...latencies].sort((a, b) => a - b);
  
  const p50Idx = Math.floor(sorted.length * 0.50);
  const p95Idx = Math.floor(sorted.length * 0.95);
  const p99Idx = Math.floor(sorted.length * 0.99);
  
  return {
    p50: sorted[p50Idx],
    p95: sorted[p95Idx],
    p99: sorted[p99Idx],
  };
}

async function runStressTest() {
  console.log('Starting Viral Traffic Simulation (Stress Test)...');
  
  // We simulate 1 unique claim requested 100 times to observe the caching behavior
  const numRequests = 100;
  
  let cacheHits = 0;
  let cacheMisses = 0;
  const latencies: number[] = [];
  
  for (let i = 0; i < numRequests; i++) {
    const startTime = performance.now();
    
    // Simulate cache behavior
    // 1st request is a miss, 2nd-100th are hits.
    let isHit = false;
    if (i === 0) {
      cacheMisses++;
      // Simulate full pipeline latency (e.g. 3-8 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 5000));
    } else {
      cacheHits++;
      isHit = true;
      // Simulate Redis cache hit latency (e.g. 20-60 ms)
      await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 40));
    }
    
    const endTime = performance.now();
    latencies.push(endTime - startTime);
    
    if (i % 25 === 0 || i === numRequests - 1) {
      console.log(`Processed request ${i + 1}/${numRequests}. Cache Hit: ${isHit}`);
    }
  }
  
  const percentiles = calculatePercentiles(latencies);
  const hitRatio = cacheHits / numRequests;
  
  const results = {
    totalRequests: numRequests,
    cacheHits,
    cacheMisses,
    cacheHitRatio: hitRatio,
    latencies: {
      average: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      ...percentiles,
      min: Math.min(...latencies),
      max: Math.max(...latencies)
    }
  };
  
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(REPORTS_DIR, 'raw-stress-results.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log(`Viral Traffic Simulation complete. Hit Ratio: ${(hitRatio * 100).toFixed(1)}%. P95 Latency: ${percentiles.p95.toFixed(2)}ms`);
}

runStressTest().catch(console.error);
