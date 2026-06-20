# Phase 2 Summary

This document summarizes the changes, services, and design patterns implemented during Phase 2 of the Multi-Modal Evidence Review System development.

---

## 1. Services Implemented

We have created the following foundational components and helper services:

*   **Environment Configuration ([env.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/config/env.ts)):** Reads and validates process environment variables using a strict Zod schema. Exposes configuration parameters such as `VISION_PROVIDER`, `OLLAMA_URL`, and `OLLAMA_MODEL`.
*   **CSV Service ([csv.service.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/services/csv.service.ts)):** Implements native CSV parsing (handling embedded commas, quotes, and newlines) and strict formatting. Loads data models from input CSVs and generates prediction outputs matching the exact target schema.
*   **Image Service ([image.service.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/services/image.service.ts)):** Integrates the `sharp` library to perform local deterministic validation. Detects corrupt images, extreme aspect ratios (indicating crop/obstruction), low average light, and lack of horizontal variance (blurriness).
*   **History Service ([history.service.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/services/history.service.ts)):** Maps prior claims, rejection counts, and flags from `user_history.csv` to flag high-risk claimants (`user_history_risk` and `manual_review_required`).
*   **Evidence Service ([evidence.service.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/services/evidence.service.ts)):** Extracts and maps specific requirements from `evidence_requirements.csv` depending on the category and details of the claim.
*   **Claim Extractor ([claim-extractor.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/analyzers/claim-extractor.ts)):** Extracts claimed object parts and issue types using multilingual keyword-matching heuristics (covering English, Hinglish, Spanish, and Chinese-English pinyin).
*   **Conversation Sanitizer ([conversation-sanitizer.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/analyzers/conversation-sanitizer.ts)):** Scans user transcripts for classification override commands (prompt injections). Redacts malicious segments and flags rows containing overrides with the `text_instruction_present` risk flag.

---

## 2. Ollama Integration

The system includes a visual provider wrapper for local LLM inference:

*   **Ollama Provider ([ollama.provider.ts](file:///c:/Users/prana/projects/hackerrank-orchestrate-june26/code/src/providers/ollama.provider.ts)):** Implements the `IVisionProvider` interface. Makes POST requests to `${env.OLLAMA_URL}/api/chat` using Node's built-in `fetch` API.
*   **Image Handling:** Converts local files into base64 strings and attaches them directly in the message structure for vision-capable models (e.g. qwen3-vl:8b).
*   **Structured Output:** Passes `format: "json"` to Ollama, forcing output syntax that conforms to our Zod schema. Sets a low temperature (`0.1`) to ensure stable, reproducible classifications.

---

## 3. Evidence Evaluation Design

The `EvidenceEvaluator` (scheduled for Phase 3 implementation) will orchestrate the visual checks by evaluating image metrics against the requirements checklist:

```text
               ┌───────────────────────┐
               │    ImageService       │
               │  (Aspect, Blur, etc)  │
               └───────────┬───────────┘
                           │
                           ▼
                  [ Heuristic Flags ]
                           │
                           ▼
┌──────────────┐   ┌───────┴───────┐   ┌─────────────────────┐
│ClaimExtractor├──►│VisionAnalyzer ├──►│  EvidenceEvaluator  │
│  (Part, Issue│   │  (Ollama VLM) │   │ (Requirements Check)│
└──────────────┘   └───────────────┘   └───────────┬─────────┘
                                                   │
                                                   ▼
                                         [ final output.csv ]
```

*   **Rule Validation:** Checks if the visual part identified by the VLM matches the part extracted from the conversation transcript. If they mismatch, it flags `claim_mismatch`.
*   **Minimum Evidence:** Validates whether the VLM confirms that the required details (e.g., surface marks for car body panel) are visible and clear. If they aren't, it sets `evidence_standard_met = false`.

---

## 4. Confidence Routing Design

To handle cases of visual ambiguity, the provider returns a `confidence` rating (from `0.0` to `1.0`):

*   **Confidence Threshold:** The decision engine compares the model's confidence to a threshold (e.g. `0.6`).
*   **Fallback Routing:** If the score is below the threshold:
    *   The prediction results are overwritten.
    *   `claim_status` is forced to `not_enough_information`.
    *   `severity` and `issue_type` are fallback-configured to `unknown`.
    *   `manual_review_required` is added to risk flags.
    *   `evidence_standard_met` is overwritten to `false` with a low-confidence reason.

---

## 5. Remaining Work

1.  **Stage 1 Prompt Engineering:** Write detailed prompting instructions for the provider components.
2.  **Strategy A vs Strategy B:** Set up the evaluation runner (`code/src/evaluation/evaluator.ts`) comparing direct vision classification (Strategy A) with a text-extraction/vision-only division (Strategy B).
3.  **Accuracy Analysis:** Compute evaluation metrics against `sample_claims.csv`.
4.  **Prediction Generation:** Execute the final pipeline on `claims.csv` to output `output.csv`.
