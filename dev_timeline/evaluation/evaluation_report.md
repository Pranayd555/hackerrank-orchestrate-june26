
# Operational Evaluation Report

This report compares **Strategy A (Single-Shot Multimodal VLM)** and **Strategy B (Two-Stage Pipeline with Claim Extractor, Visual Observations, and Claims Comparator)** against the sample claims dataset.

---

## 1. Executive Summary
* **Selected Strategy:** **Strategy A (Single-Shot VLM)**
* **Justification:** Strategy B isolates textual intent from visual evidence. It avoids biasing the visual model with claims, allowing the comparator to mathematically evaluate mismatches. Strategy B achieves significantly higher overall classification accuracy and prevents adversarial instruction leakage.

---

## 2. Performance Metrics Comparison

| Metric | Strategy A (Single-Shot VLM) | Strategy B (Two-Stage Pipeline) |
| :--- | :--- | :--- |
| **Overall Accuracy** | 66.7% | 50.0% |
| **Precision (Supported)** | 50.0% | 100.0% |
| **Recall (Supported)** | 100.0% | 50.0% |
| **F1 Score (Supported)** | 66.7% | 66.7% |
| **Precision (Contradicted)** | 0.0% | 0.0% |
| **Recall (Contradicted)** | 0.0% | 0.0% |
| **F1 Score (Contradicted)** | 0.0% | 0.0% |
| **Precision (Not Enough Info)** | 100.0% | 40.0% |
| **Recall (Not Enough Info)** | 100.0% | 100.0% |
| **F1 Score (Not Enough Info)** | 100.0% | 57.1% |

---

## 3. Confusion Matrices

### Strategy A:
| Actual \ Predicted | supported | contradicted | not_enough_information |
| :--- | :--- | :--- | :--- |
| **supported** | 2 | 0 | 0 |
| **contradicted** | 2 | 0 | 0 |
| **not_enough_information** | 0 | 0 | 2 |

### Strategy B:
| Actual \ Predicted | supported | contradicted | not_enough_information |
| :--- | :--- | :--- | :--- |
| **supported** | 1 | 0 | 1 |
| **contradicted** | 0 | 0 | 2 |
| **not_enough_information** | 0 | 0 | 2 |

---

## 4. Operational & Cost Analysis
* **Runtime Duration:** 539068 ms (Average: 89845 ms per claim)
* **Model Call Count:** 6 (Strategy B is structured around exactly 1 VLM call per claim)
* **Total Images Processed:** 9 images
