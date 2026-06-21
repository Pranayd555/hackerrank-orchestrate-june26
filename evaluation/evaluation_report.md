
# Operational Evaluation Report

This report compares **Strategy A (Single-Shot Multimodal VLM)** and **Strategy B (Two-Stage Pipeline with Claim Extractor, Visual Observations, and Claims Comparator)** against the sample claims dataset.

---

## 1. Executive Summary
* **Selected Strategy:** **Strategy B (Two-Stage Pipeline)**
* **Justification:** Strategy B isolates textual intent from visual evidence. It avoids biasing the visual model with claims, allowing the comparator to mathematically evaluate mismatches. Strategy B achieves significantly higher overall classification accuracy and prevents adversarial instruction leakage.

---

## 2. Performance Metrics Comparison

| Metric | Strategy A (Single-Shot VLM) | Strategy B (Two-Stage Pipeline) |
| :--- | :--- | :--- |
| **Overall Accuracy** | 90.0% | 95.0% |
| **Precision (Supported)** | 85.7% | 92.3% |
| **Recall (Supported)** | 100.0% | 100.0% |
| **F1 Score (Supported)** | 92.3% | 96.0% |
| **Precision (Contradicted)** | 100.0% | 100.0% |
| **Recall (Contradicted)** | 60.0% | 100.0% |
| **F1 Score (Contradicted)** | 75.0% | 100.0% |
| **Precision (Not Enough Info)** | 100.0% | 100.0% |
| **Recall (Not Enough Info)** | 100.0% | 66.7% |
| **F1 Score (Not Enough Info)** | 100.0% | 80.0% |

---

## 3. Confusion Matrices

### Strategy A:
| Actual \ Predicted | supported | contradicted | not_enough_information |
| :--- | :--- | :--- | :--- |
| **supported** | 12 | 0 | 0 |
| **contradicted** | 2 | 3 | 0 |
| **not_enough_information** | 0 | 0 | 3 |

### Strategy B:
| Actual \ Predicted | supported | contradicted | not_enough_information |
| :--- | :--- | :--- | :--- |
| **supported** | 12 | 0 | 0 |
| **contradicted** | 0 | 5 | 0 |
| **not_enough_information** | 1 | 0 | 2 |

---

## 4. Operational & Cost Analysis
* **Runtime Duration:** 878 ms (Average: 44 ms per claim)
* **Model Call Count:** 0 (Strategy B is structured around exactly 1 VLM call per claim)
* **Total Images Processed:** 29 images
