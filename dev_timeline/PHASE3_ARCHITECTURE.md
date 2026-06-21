# Phase 3 Architecture Plan

This document outlines the detailed design, inputs, outputs, interfaces, and failure modes for the remaining components scheduled for Phase 3 implementation.

---

## 1. Vision Analyzer (`code/src/analyzers/vision.analyzer.ts`)

### Description
The `VisionAnalyzer` coordinates VLM queries by selecting the active provider (Ollama or Gemini fallback) and passing the base64-encoded images along with structured instructions.

*   **Inputs:**
    *   `claimObject`: `'car' | 'laptop' | 'package'`
    *   `expectedPart`: `ObjectPart` (from `ClaimExtractor`)
    *   `expectedIssue`: `IssueType` (from `ClaimExtractor`)
    *   `images`: `Array<{ id: string; buffer: Buffer; mimeType: string }>`
    *   `evidenceRequirements`: `string[]` (from `EvidenceService`)
*   **Outputs:**
    *   `VisionAnalysisResult` (containing evidence sufficiency, observed part, observed issue, visual flags, supporting images, valid image, severity, confidence)
*   **Dependencies:**
    *   `IVisionProvider`
    *   `ModelOutputSchema` (Zod)
*   **Interfaces:**
    ```typescript
    export class VisionAnalyzer {
      constructor(private provider: IVisionProvider);
      public async analyzeEvidence(input: VisionAnalysisInput): Promise<VisionAnalysisResult>;
    }
    ```
*   **Failure Modes & Fallbacks:**
    *   *Failure:* Ollama request times out or returns malformed/non-JSON text.
    *   *Fallback:* Catches error, logs warning, returns a safe default result with `confidence = 0.0`, `valid_image = false`, and `claim_status = not_enough_information`.

---

## 2. Claim Comparator (`code/src/analyzers/comparator.ts`)

### Description
Compares the expected claim (derived textually) with the observed claim (derived visually) and flags discrepancies (e.g. mismatch between claimed dent and observed scratch).

*   **Inputs:**
    *   `expectedClaim`: `{ part: ObjectPart; issue: IssueType }`
    *   `observedClaim`: `{ part: ObjectPart; issue: IssueType; severity: Severity }`
*   **Outputs:**
    *   `status`: `'supported' | 'contradicted' | 'not_enough_information'`
    *   `mismatchFlags`: `string[]` (e.g., `['claim_mismatch', 'wrong_object_part']`)
    *   `justification`: `string`
*   **Dependencies:**
    *   `types/index.ts`
*   **Interfaces:**
    ```typescript
    export class ClaimComparator {
      public compare(expected: ExtractedClaim, observed: ModelOutput): ComparisonResult;
    }
    ```
*   **Failure Modes & Fallbacks:**
    *   *Failure:* Either the expected or observed part is classified as `unknown`.
    *   *Fallback:* If the expected part is `unknown` but observed shows damage, matches broad category rules. If observed is `unknown`, defaults comparison to `not_enough_information`.

---

## 3. Evidence Evaluator (`code/src/analyzers/evidence.evaluator.ts`)

### Description
Aggregates local image validation metrics (from `ImageService`) and visual evidence sufficiency reports to determine if the claim meets the required standard.

*   **Inputs:**
    *   `imageValidations`: `ImageValidationResult[]`
    *   `visionResult`: `VisionAnalysisResult`
*   **Outputs:**
    *   `evidence_standard_met`: `boolean`
    *   `evidence_standard_met_reason`: `string`
    *   `quality_flags`: `string[]` (e.g., `['blurry_image', 'cropped_or_obstructed']`)
*   **Dependencies:**
    *   `types/index.ts`
*   **Interfaces:**
    ```typescript
    export class EvidenceEvaluator {
      public evaluate(validations: ImageValidationResult[], visionResult: VisionAnalysisResult): EvaluationResult;
    }
    ```
*   **Failure Modes & Fallbacks:**
    *   *Failure:* Sharp indicates all submitted images are unreadable.
    *   *Fallback:* Aborts VLM pipeline early, sets `evidence_standard_met = false`, and returns `valid_image = false` immediately.

---

## 4. Decision Engine (`code/src/analyzers/decision.analyzer.ts`)

### Description
The final pipeline orchestrator that processes history risks, text sanitization, image validations, VLM outputs, and comparator results, applying confidence-based threshold routing.

*   **Inputs:**
    *   `claimInput`: `ClaimInput`
    *   `sanitizedTranscript`: `SanitizationResult`
    *   `historyFlags`: `string[]`
    *   `evidenceEvaluation`: `EvaluationResult`
    *   `comparison`: `ComparisonResult`
    *   `confidence`: `number`
*   **Outputs:**
    *   `ClaimOutput` (Zod-validated object)
*   **Dependencies:**
    *   `ClaimOutputSchema` (Zod)
*   **Interfaces:**
    ```typescript
    export class DecisionEngine {
      public makeDecision(input: DecisionInput): ClaimOutput;
    }
    ```
*   **Failure Modes & Fallbacks:**
    *   *Failure:* VLM confidence score is below threshold (e.g., `< 0.6`), or Zod schema validation fails.
    *   *Fallback (Confidence Routing):* Overrides output `claim_status` to `not_enough_information`, resets `issue_type` and `object_part` to `unknown`, sets `severity` to `unknown`, and adds `manual_review_required`.

---

## 5. Evaluation Framework (`code/src/evaluation/evaluator.ts`)

### Description
Calculates precision, recall, and accuracy metrics of Strategy A vs Strategy B against `sample_claims.csv` to prove our architectural choices.

*   **Inputs:**
    *   `dataset/sample_claims.csv`
*   **Outputs:**
    *   `evaluation/evaluation_report.md` (Operational analysis, costs, token usage, latency, and accuracy statistics)
*   **Dependencies:**
    *   `CSVService`
*   **Interfaces:**
    ```typescript
    export class EvaluationRunner {
      public async run(): Promise<void>;
    }
    ```
*   **Failure Modes & Fallbacks:**
    *   *Failure:* Sample claims data is missing expected columns.
    *   *Fallback:* Checks structure during parsing and skips corrupted rows without crashing.
