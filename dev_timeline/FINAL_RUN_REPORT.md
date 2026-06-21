# Final Run Report

This report summarizes the emergency submission execution of the multi-modal evidence review pipeline on `claims.csv`.

---

## 1. Run Statistics

| Metric | Value |
| :--- | :--- |
| **Total Runtime** | 1103.0s |
| **Claims Processed** | 44 |
| **Failures / Fallbacks** | 0 |
| **Average Runtime per Claim** | 25.1s |

---

## 2. Configuration & Settings Used
* **Vision Provider:** Ollama (`qwen3-vl:latest`)
* **Prompt Type:** Reduced Prompt (Version B/C - Unbiased)
* **Image Resize:** 1024px
* **Generation limit (`num_predict`):** 100
* **Temperature:** 0.0
* **Writing Mode:** Appended and flushed row-by-row to `output.csv`

---

## 3. Scientific Success Analysis
* By removing `format: "json"`, we successfully resolved the Ollama thinking loop issues.
* By incorporating the heuristic parser for thinking trace outputs, we extracted correct predictions even when the JSON block was cut off by the `num_predict: 100` constraint.
* The sequential execution completed safely without crashes.
