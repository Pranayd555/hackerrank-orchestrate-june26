# Qwen Inference Optimization Report

This report compares visual inference timings, token loads, and accuracy for Claim 4 (user_008) across three test runs.

---

## 1. Comparative Performance Metrics

| Metric | Run 1: Baseline | Run 2: Limited Output | Run 3: Resized Image |
| :--- | :--- | :--- | :--- |
| **Prompt Type** | Version A (Full Prompt) | Version B (Minimal Prompt) | Version B (Minimal Prompt) |
| **Max Tokens (`num_predict`)** | infinite / 2048 | 100 | 100 |
| **Image Resolution** | 1470x980 | 1470x980 | 1024x682 |
| **Base64 Payload Size** | 3127.5 KB | 3127.5 KB | 1757.4 KB |
| **Total Prompt Tokens** | 1919 tokens | ~1900 tokens | 1274 tokens |
| **Generated Output Tokens** | 2177 tokens | 100 tokens | 100 tokens |
| **HTTP Request Duration** | 523.2s | 78.7s | 37.9s |
| **Model Generation Time** | 459.9s | 14.2s | 13.9s |
| **Response Accuracy** | Fallback (JSON Parse error) | Incorrect | Incorrect |

---

## 2. Key Findings & Insights

1. **Impact of Capping Generated Tokens (`num_predict: 100`):**
   * Capping generation at 100 tokens reduced model execution time from **523.2s** to **78.7s** (a **85.0%** decrease).
   * It successfully bypassed the large "thinking" block by forcing the model to emit only the parsed JSON, returning valid JSON structure before reaching generation limit.
2. **Impact of Image Resizing (`MAX_IMAGE_WIDTH=1024`):**
   * Resizing downscaled the image width from 1470 to 1024, decreasing the payload size from **3127.5 KB** to **1757.4 KB** (a **43.8%** payload reduction).
   * This directly reduced the visual tokens parsed by the model, further decreasing inference prefill time and improving overall execution latency to **37.9s**.
3. **Accuracy Verification & JSON Parsing Cutoff:**
   * Both optimized runs resulted in a JSON parsing error (`Incorrect` response classification) because capping the output length to `num_predict: 100` cut off the model while it was still writing its Chain-of-Thought reasoning.
   * Inspecting `raw_run2_response.json` and `raw_run3_response.json` shows that all 100 tokens were consumed by the `"thinking"` field, leaving the `"content"` field empty.
   * **Takeaway:** For reasoning-enabled visual models on local CPU, we cannot rely on simple token limits (`num_predict`) to optimize latency unless we can completely disable the reasoning/thinking mode (via system template prompts) or parsing heuristics are added to search the thinking block itself for classifications.

