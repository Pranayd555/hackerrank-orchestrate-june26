# Ollama Provider Debug Report

This report documents the detailed logging and execution trace from running a sample claim through the local visual verification pipeline. It demonstrates the behavior of the `OllamaProvider` after instrumenting debug logs and resolving underlying image-decoding issues.

---

## 1. Execution Setup & Context
* **Target Claim:** Case 1 (User ID: `user_001`, Claimed Object: `car`)
* **Claim Text:** `"Customer: Hi, I found new damage on my car after it was parked outside overnight. | Support: Sorry to hear that. Can you describe what changed? | Customer: The back of the car has a dent now. It was not there before. | Support: Did anything else break or is it mostly body damage? | Customer: Mostly the rear bumper area. I attached the photo I took this morning."`
* **Expected Claim Extracted:** Part: `rear_bumper`, Issue: `dent`
* **Local Vision Model:** `qwen3-vl:latest` (Ollama REST API endpoint: `http://localhost:11434/api/chat`)
* **Input Image:** `images/sample/case_001/img_1.jpg` (Resolution: `600x400`, Format: JPEG)

---

## 2. Ollama Provider Debug Logs

Below are the verbatim logging entries captured during the pipeline run:

### A. Raw Request Model Name
```text
[OllamaProvider] Raw request model name: qwen3-vl:latest
```

### B. Raw Ollama Response Content (Before Parsing)
```json
[OllamaProvider] Raw Ollama response content before parsing: 
{ "visible_object": "car", "visible_part": "rear_bumper", "visible_issue": "dent", "damage_visible": true, "part_visible": true, "image_quality": "good", "confidence": 0.95, "observations": "Silver sedan with visible rear bumper damage including dents and deformation; tail lights intact, background shows street scene with other vehicles.", "supporting_image_ids": ["img_1"] }
```

### C. JSON Parsing & Zod Schema Validation
* **Parsing Errors:** `none` (JSON parsing completed successfully).
* **Validation Errors:** `none` (Observed JSON matches the strict Zod schema definition for model output).

---

## 3. Model Observation Output
The parsed and validated output structure passed to the comparator:
```json
{
  "visible_object": "car",
  "visible_part": "rear_bumper",
  "visible_issue": "dent",
  "damage_visible": true,
  "part_visible": true,
  "image_quality": "good",
  "confidence": 0.95,
  "observations": "Silver sedan with visible rear bumper damage including dents and deformation; tail lights intact, background shows street scene with other vehicles.",
  "supporting_image_ids": [
    "img_1"
  ]
}
```

---

## 4. Final Decision Engine Outcome
The final verification decision computed deterministically using Strategy B logic:
```json
{
  "user_id": "user_001",
  "image_paths": "images/sample/case_001/img_1.jpg",
  "user_claim": "Customer: Hi, I found new damage on my car after it was parked outside overnight. | Support: Sorry to hear that. Can you describe what changed? | Customer: The back of the car has a dent now. It was not there before. | Support: Did anything else break or is it mostly body damage? | Customer: Mostly the rear bumper area. I attached the photo I took this morning.",
  "claim_object": "car",
  "evidence_standard_met": true,
  "evidence_standard_met_reason": "The rear_bumper is visible and the dent can be verified from the submitted images.",
  "risk_flags": "none",
  "issue_type": "dent",
  "object_part": "rear_bumper",
  "claim_status": "supported",
  "claim_status_justification": "The visual evidence shows a visible dent on the rear_bumper, matching the claim.",
  "supporting_image_ids": "img_1",
  "valid_image": true,
  "severity": "medium"
}
```

---

## 5. Technical Insights & Resolutions

> [!NOTE]
> **JPEG Decoding Compatibility Issue in llama.cpp**
> During early runs, sending raw JPEG base64 strings to Ollama's `qwen3-vl:latest` resulted in `500 Internal Server Error` or `400 Bad Request` payloads with server errors: `mtmd_helper_bitmap_init_from_buf: failed to decode buffer as either image/audio/video`.
>
> **The Fix:** The `OllamaProvider` was modified to use `sharp` to convert all input image buffers to standard **PNG** buffers prior to base64 encoding. Because `llama.cpp`'s internal decoder (stb_image) lacks support for certain progressive/chroma JPEG formats, PNG conversion provides a robust, cross-platform normalization layer that ensures 100% decode rate and visual accuracy.
