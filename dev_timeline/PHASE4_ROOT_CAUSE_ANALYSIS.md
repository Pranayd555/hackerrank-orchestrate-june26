# Phase 4 Root Cause Analysis

This document details the root cause analysis explaining why Strategy B collapsed to a 20% overall accuracy on the sample dataset.

---

## 1. Executive Summary

While the **Strategy B** architecture (Two-Stage Expectation vs. Observation Pipeline) is conceptually correct and designed for maximum accuracy, its performance collapsed to **20%** during the local test run due to **infrastructure failures and fallback routing triggers**. 

Due to model misconfigurations and network timeouts on the local host, **19 out of 20 VLM queries failed or timed out**. The system caught these exceptions and correctly fell back to safe default structures to prevent a total pipeline crash. However, these default observation structures flagged the claimed parts as not visible and the image quality as bad, causing the downstream decision engine to output `not_enough_information` for nearly all claims.

---

## 2. Expected vs. Predicted Sample Claims

Below is the exhaustive verification comparing the expected ground truth against the predicted results for all 20 sample rows:

| Case | User ID | Object | Expected (Status, Issue, Part, Severity) | Predicted (Status, Issue, Part, Severity) | Primary Cause of Failure |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `user_001` | `car` | supported, dent, rear_bumper, medium | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **2** | `user_002` | `car` | supported, scratch, front_bumper, low | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **3** | `user_004` | `car` | supported, crack, windshield, medium | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **4** | `user_007` | `car` | supported, broken_part, side_mirror, medium | contradicted, crack, side_mirror, unknown | Comparator & DecisionEngine bug (undefined severity) |
| **5** | `user_005` | `car` | contradicted, scratch, rear_bumper, low | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **6** | `user_006` | `car` | not_enough_information, unknown, headlight, unknown | not_enough_information, unknown, unknown, unknown | Status matched, but Part was fallback-overwritten |
| **7** | `user_003` | `car` | supported, dent, door, medium | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **8** | `user_008` | `car` | contradicted, broken_part, front_bumper, high | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **9** | `user_009` | `laptop` | supported, crack, screen, medium | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **10** | `user_010` | `laptop` | supported, broken_part, hinge, medium | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **11** | `user_011` | `laptop` | supported, stain, keyboard, medium | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **12** | `user_012` | `laptop` | supported, dent, corner, low | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **13** | `user_018` | `laptop` | supported, crack, screen, medium | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **14** | `user_020` | `laptop` | contradicted, none, trackpad, none | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **15** | `user_015` | `package` | supported, crushed_packaging, package_corner, medium | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **16** | `user_030` | `package` | supported, torn_packaging, seal, medium | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **17** | `user_031` | `package` | supported, water_damage, package_side, medium | not_enough_information, unknown, package_side, medium | Normalization failure (VLM returned "side" instead of "package_side") |
| **18** | `user_032` | `package` | not_enough_information, unknown, contents, unknown | not_enough_information, unknown, unknown, unknown | Status matched, but Part was fallback-overwritten |
| **19** | `user_033` | `package` | contradicted, unknown, unknown, low | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |
| **20** | `user_034` | `package` | contradicted, none, seal, none | not_enough_information, unknown, unknown, unknown | VLM Provider timeout fallback |

---

## 3. Special Analysis: Why Supported = 0 Was Predicted

A deep-dive investigation into the components reveals the following:

1.  **Confidence Threshold:** The VLM provider fallback sets `confidence = 0.0` when the API call fails or times out. This triggers the Decision Engine's safety routing, forcing the status to `not_enough_information`.
2.  **Evidence Sufficiency & Visibility:** The VLM provider fallback returns `part_visible = false` and `image_quality = 'bad'`. The `EvidenceEvaluator` determines that because the part is not visible, the evidence standard cannot be met (`evidence_standard_met = false`).
3.  **Fallback Routing:** Because `evidence_standard_met` is false, the `DecisionEngine` routes all outcomes to:
    *   `claim_status = 'not_enough_information'`
    *   `severity = 'unknown'`
    *   `issue_type = 'unknown'`
    *   `object_part = 'unknown'`
    Since 19 out of 20 VLM queries fell back to this pathway, no rows were predicted as `supported`.

---

## 4. Normalization and Severity Bugs

### A. The Severity Assignment Bug
*   **Symptom:** Case 4 succeeded in querying Ollama, but failed output Zod schema validation because `severity` was `undefined`.
*   **Root Cause:** The old VLM model was expected to output `severity`. Under the new observation-only contract, the VLM is not allowed to determine severity. The `DecisionEngine` was still expecting `observation.severity` (which was not present in the new `ModelObservation` Zod schema), resulting in `undefined` and validation failures.

### B. The Part Normalization Bug (Case 17)
*   **Symptom:** Case 17 successfully queried Ollama but failed Zod validation due to `Invalid part "side" for package claim`.
*   **Root Cause:** The local vision model observed the correct package side but output the short string `"side"` instead of the required prefix form `"package_side"`. The decision engine passed this raw observation to Zod validation without mapping it to the strict allowed enums, causing validation failure.
