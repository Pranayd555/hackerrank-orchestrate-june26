# Phase 4 Learnings

This document outlines the learnings, failure cases discovered, dataset-specific insights, and prompting observations from the Ollama provider debugging phase (Phase 4).

---

## 1. Failure Cases Discovered
* **llama.cpp Image Decoding Defect:** The local Ollama server's underlying visual decoder (`llama.cpp`'s `stb_image`) failed to process progressive JPEGs in the dataset. This resulted in `400 Bad Request` or `500 Internal Server Error` responses carrying the message: `mtmd_helper_bitmap_init_from_buf: failed to decode buffer as either image/audio/video`.
* **Accuracy Drop Cause:** These API exceptions were caught by the provider's fallback block, returning zero-value defaults (`confidence = 0`, `part_visible = false`, `image_quality = 'bad'`). This triggered the Decision Engine's safety routing, forcing the claim status to `not_enough_information` for all affected claims (producing 20% accuracy overall).

## 2. Dataset-Specific Insights
* **Image Size & Dimensions:** While the images are valid JPEGs of size `600x400`, their progressive encoding or specific EXIF data format is incompatible with local Ollama's embedded decoder. 
* **PNG Normalization:** Converting the buffers to standard PNG using `sharp` increases the base64 payload size (~560KB vs ~70KB) but provides a robust format that the visual model decodes correctly.

## 3. Prompting & Parsing Observations
* **Observation-Only Model Constraints:** Under the Qwen3-VL contract, restricting the model to visual observations (rather than policy judgments) results in highly accurate classifications.
* **JSON Format Compatibility:** When querying Qwen3-VL in Ollama, using the REST API parameter `format: 'json'` combined with a structured prompt works perfectly, provided the image format is valid. The model returns clean JSON that passes Zod validation with high confidence.
