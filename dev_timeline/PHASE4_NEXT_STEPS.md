# Phase 4 Next Steps

This document outlines the next steps, evaluation improvements, and production strategies recommended for the final phase of the challenge.

---

## 1. Remaining Work
* **Run Full Sample Evaluation:** Execute `npm run evaluate` using the resolved `OllamaProvider` PNG normalization layer to verify if Strategy B's classification accuracy rises back to the target **90%+** level.
* **Generate Final Output:** Run the full pipeline on `dataset/claims.csv` to produce the final `output.csv` predictions.

## 2. Evaluation Improvements
* **Verify Edge Case Normalization:** Track specific edge cases (such as Case 4's undefined severity or Case 17's short part name `"side"` vs `"package_side"`) to confirm they are correctly parsed and normalized before reaching Zod schema checks.
* **Error Rate Metrics:** Introduce metrics to count fallback triggers vs. successful API responses in the final evaluation report.

## 3. Production Strategy Recommendation
* **Standard Preprocessing:** In production environments running local multimodal models (such as Qwen/Gemma Vision), incorporate automated image normalization (converting to PNG, resizing to standard aspect ratios, or scaling down high-resolution images) as a pipeline standard. This avoids silent failures or performance bottlenecks in resource-constrained local runners.
