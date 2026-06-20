# Multi-Modal Evidence Review System

## Overview

This project implements a deterministic multi-modal evidence verification pipeline for insurance and damage claim assessment.

The system combines:

* Conversation Analysis
* Claim Extraction
* Visual Evidence Analysis (Qwen3-VL via Ollama)
* Evidence Requirement Validation
* Risk Analysis
* Deterministic Decision Engine
* Output Schema Validation

The final result is generated as `output.csv`.

---

## Architecture

```text
Claim CSV
    ↓
Conversation Sanitizer
    ↓
Claim Extractor
    ↓
Expected Claim

Images
    ↓
Image Validation
    ↓
Vision Analyzer (Qwen3-VL)
    ↓
Observed Claim

Expected + Observed
    ↓
Comparator
    ↓
Evidence Evaluator
    ↓
Decision Engine
    ↓
Output Validation
    ↓
output.csv
```

---

## Requirements

* Node.js 22+
* Ollama
* qwen3-vl model
* npm

---

## Install

```bash
npm install
```

Install the model:

```bash
ollama pull qwen3-vl
```

Start Ollama:

```bash
ollama serve
```

---

## Configuration

Environment variables:

```env
VISION_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3-vl
```

---

## Run Evaluation

Evaluate against sample dataset:

```bash
npm run evaluate
```

Fast evaluation:

```bash
npm run evaluate:fast
```

Debug single claim:

```bash
npm run debug:claim -- 1
```

---

## Generate Final Predictions

```bash
npm run start
```

This generates:

```text
output.csv
```

for all rows in:

```text
dataset/claims.csv
```

---

## Submission Artifacts

Included:

* output.csv
* evaluation reports
* architecture reports
* performance reports
* chat transcript log
* source code

---

## Final Model Configuration

* Model: qwen3-vl
* Provider: Ollama
* Image Resolution: 1024px
* Temperature: 0.0
* num_predict: 100

```
```
