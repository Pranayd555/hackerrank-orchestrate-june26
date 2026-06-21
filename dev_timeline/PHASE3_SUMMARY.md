# Phase 3 Summary

This document summarizes the files created, components implemented, and architectural changes introduced in Phase 3.

---

## 1. Files Created
We have created and integrated the following key files in this phase:

*   **[vision.analyzer.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/analyzers/vision.analyzer.ts):** Orchestrates VLM visual observation queries using the selected provider.
*   **[comparator.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/analyzers/comparator.ts):** Compares textually expected claim features against visually observed properties.
*   **[evidence.evaluator.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/analyzers/evidence.evaluator.ts):** Evaluates local Sharp checks and VLM details to verify evidence standard compliance.
*   **[evaluator.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/evaluation/evaluator.ts):** Implements Strategy A and Strategy B pipelines, processes the sample dataset, and logs the comparative operational report.
*   **[main.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/main.ts):** The executable pipeline driver for generating predictions.
*   **[main.py](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/main.py):** Minimal Python wrapper to trigger `main.ts` using `npx tsx`.
*   **[main.py](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/evaluation/main.py):** Minimal Python wrapper to trigger `evaluator.ts` using `npx tsx`.

---

## 2. Components Implemented

*   **Model Observation Schema ([model.schemas.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/schemas/model.schemas.ts)):** Restricted the VLM output strictly to visual features and raw observations (`visible_object`, `visible_part`, `visible_issue`, `damage_visible`, `part_visible`, `image_quality`, `confidence`, `observations`, and `supporting_image_ids`), adhering to the Qwen3-VL contract.
*   **Decision Engine ([decision.analyzer.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/analyzers/decision.analyzer.ts)):** Implemented deterministic TypeScript rules to decide final outputs (claim status, severity, risk flags, valid image, and reasons) rather than delegating them to the AI model.
*   **Comparison Engine:** Formulated comparative analysis comparing Expected vs. Observed claims to identify `wrong_object`, `wrong_object_part`, `claim_mismatch`, and `damage_not_visible`.
*   **Evaluation Runner:** Processes `sample_claims.csv` through both Single-shot and Comparison pipelines, calculating accuracy, precision, recall, and confusion matrices.

---

## 3. Architecture Changes

*   **Role Separation:** Shifted business logic entirely out of the AI model boundaries. The VLM acts solely as a "perception sensor" returning raw observations. The deterministic TypeScript logic serves as the "decision engine".
*   **Deterministic Severity Map:** Implemented a robust severity calculation mapping object types, visible parts, and observed damage issues to specific categories, preventing schema validation failures.
*   **Secure Pipelines:** Wrapped user claims in sanitization before extracting features, adding safety against prompt injections.
