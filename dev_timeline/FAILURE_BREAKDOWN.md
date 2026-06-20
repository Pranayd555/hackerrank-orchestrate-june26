# Failure Breakdown

A quantitative breakdown of the component failures responsible for the Strategy B classification drop from 90% to 20% on the sample dataset (total 20 rows).

---

## Failure Count by Component

*   **VLM Provider (Infrastructure & API timeouts/errors):** 16 failures
    *   *Description:* 16 out of 20 VLM queries encountered connection timeouts (`UND_ERR_HEADERS_TIMEOUT`) or `400 Bad Request` errors due to the non-existent model name configuration (`qwen3-vl:latest`).
*   **VisionAnalyzer (JSON formatting exception):** 2 failures
    *   *Description:* 2 queries returned empty messages or malformed non-JSON text from Ollama. The VisionAnalyzer correctly intercepted these but returned fallback structures.
*   **DecisionEngine (Schema validation & normalization):** 2 failures
    *   *Description:* 
        *   **Case 4:** successfully contacted Ollama but failed output Zod validation because the `severity` field was `undefined`.
        *   **Case 17:** successfully contacted Ollama but failed output Zod validation because the model returned `"side"` instead of the required prefix form `"package_side"`.
*   **ClaimExtractor (Keyword mismatch):** 0 failures
    *   *Description:* The keyword extraction matched expected parts and issue types correctly.
*   **Comparator (Discrepancy error):** 0 failures
    *   *Description:* The comparative logic executed properly when visual observations were successfully returned.
*   **EvidenceEvaluator (Sufficiency evaluation failure):** 0 failures
    *   *Description:* The evaluator correctly computed sufficiency based on the input validations.

---

## Summary Matrix

```text
Ollama VLM Provider (Infrastructure) ... 16
VisionAnalyzer (Parsing) ................ 2
DecisionEngine (Zod & Normalization) .... 2
ClaimExtractor .......................... 0
Comparator .............................. 0
EvidenceEvaluator ....................... 0
--------------------------------------------
Total Failures .......................... 20
```
