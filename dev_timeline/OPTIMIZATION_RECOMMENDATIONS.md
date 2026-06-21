# Optimization Recommendations

This document outlines the ranked optimization recommendations to restore the Multi-Modal Evidence Review System from a 20% baseline to a 90%+ target accuracy on the sample dataset.

---

## 1. High Impact Recommendations

### Fix Ollama Model Configuration
*   **Problem:** The model default in `env.ts` was changed to `qwen3-vl:latest`. This model is non-existent in Ollama's public library, causing instant `400 Bad Request` API errors.
*   **Fix:** Revert `OLLAMA_MODEL` to a valid vision model pulled in Ollama (e.g., `qwen2.5-vl:latest` or `qwen2.5-vl:7b`).
*   **Expected Accuracy Gain:** **+70%** (restores actual visual inspection on 16 out of 20 failed cases).

### Fix Severity Schema Validation Bug
*   **Problem:** The VLM model observations do not include severity. The DecisionEngine was trying to read `observation.severity` which was `undefined`, triggering output Zod validation failures.
*   **Fix:** Calculate `severity` deterministically inside the TypeScript `DecisionEngine` using a part-and-issue-to-severity category mapping (implemented).
*   **Expected Accuracy Gain:** **+5%** (prevents output validation crashes on successful VLM responses).

### Add Model Observation Normalization Mapping
*   **Problem:** The VLM sometimes returns shortened words like `"side"` instead of `"package_side"`, or `"corner"` instead of `"package_corner"`, causing output schema validation to reject the predictions.
*   **Fix:** Implement a robust mapper in the Decision Engine that normalizes raw string observations to the exact allowed enum lists (e.g., mapping `"side"` $\rightarrow$ `"package_side"` and `"corner"` $\rightarrow$ `"package_corner"` depending on the claim object type).
*   **Expected Accuracy Gain:** **+5%** (prevents enum validation crashes).

---

## 2. Medium Impact Recommendations

### Mitigate Network/Inference Timeouts
*   **Problem:** Node's built-in `fetch` (undici) times out (`UND_ERR_HEADERS_TIMEOUT`) when the local Ollama VLM takes more than 30 seconds to run visual inference.
*   **Fix:** Use a custom `fetch` wrapper with an explicit AbortSignal timeout of 90 seconds, and add a retry mechanism (up to 2 retries) with exponential backoff on connection errors.
*   **Expected Accuracy Gain:** **+10%** (prevents random GPU timeout fallbacks on slow local hardware).

---

## 3. Low Impact Recommendations

### Expand Multilingual Keyword Dictionary
*   **Problem:** Transcripts mix Hinglish, Spanish, and Chinese-English.
*   **Fix:** Add more slang keywords to the `ClaimExtractor` mapping definitions (e.g. mapping "dano en el parachoques" to "rear_bumper"/"front_bumper", and "toot" to "broken_part").
*   **Expected Accuracy Gain:** **+5%** (prevents edge case mismatches during claims translation).
