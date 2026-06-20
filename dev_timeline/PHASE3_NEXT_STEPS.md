# Phase 3 Next Steps

This document outlines the remaining work, evaluation improvements, and production strategy recommendations.

---

## 1. Remaining Work

1.  **Run Final Inference:** Run `python code/main.py` to process the test dataset `dataset/claims.csv` and generate the final predictions in `output.csv`.
2.  **Schema Verification:** Run Zod verification on the final generated `output.csv` to ensure all 44 rows conform strictly to headers, orders, enums, and values.
3.  **Chat Transcript Check:** Collect the final `log.txt` from `%USERPROFILE%/hackerrank_orchestrate/log.txt` to prepare it for submission alongside the code.

---

## 2. Evaluation Improvements

1.  **VLM Comparison Benchmark:** Run the evaluation pipeline with other vision-capable models (e.g. `llama3.2-vision:latest`, `minicpm-v:latest`) on Ollama and compare their F1 scores.
2.  **Confidence Threshold Calibration:** Tune the confidence threshold (currently `0.6` by default) to find the optimal trade-off between false-positives and manual review rates.
3.  **Hinglish / Spanish Keyword Expansion:** Expand the heuristics in `ClaimExtractor` to cover more slang terms observed in test datasets.

---

## 3. Production Strategy Recommendation

1.  **Image Feature Caching:** In production, claimants sometimes submit the same photo multiple times or submit duplicates from different angles. Use a perceptual hash cache (like `pHash`) to index processed images. If a matching image is seen, retrieve the VLM observation directly from cache, reducing VLM processing cost to 0.
2.  **Concurrency Throttle:** Running local VLM inference sequentially is slow. Implement a worker pool using an asynchronous message queue (e.g., BullMQ / Redis) to process claims concurrently while throttling active requests to match hardware concurrency limits.
3.  **VLM Provider Failover:** Configure a dynamic failover router. If local Ollama fails (network offline or GPU out of memory), route VLM requests to hosted serverless API endpoints (like Together AI or OpenRouter) as a fallback to guarantee high system availability.
