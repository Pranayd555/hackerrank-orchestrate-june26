# Performance Report

## Executive Telemetry Summary
* **Total Runtime:** 539.07s
* **Cache Hit Rate:** 16.7% (1 Hits / 5 Misses)
* **Slowest Operation:** VisionAnalyzer (Claim 4 (user_008)) - 120116.8ms

---

## Detailed Performance Analysis

### Claim Processing Timings
* **Average Runtime per Claim:** 89.84s
* **Slowest Claim Runtime:** 120.14s
* **Fastest Claim Runtime:** 0.03s

### Stage-by-Stage Average Latencies
* **CSV Loading Time:** 7.0ms
* **Average Image Validation Time:** 30.4ms
* **Average Model Call Response Time:** 58.56s
* **Average Comparator Match Time:** 0.04ms
* **Average Evidence Evaluation Time:** 0.06ms
* **Average Decision Engine Logic Time:** 0.32ms
* **CSV Writing Time:** 0.7ms

---

## Recommended Optimizations
> [!WARNING]
> **Local Inference Overhead:** Ollama model calls are taking an average of **58.6s**. Upgrading the inference hardware (GPU) or running a quantized GGUF format of qwen3-vl will yield significant performance gains.
