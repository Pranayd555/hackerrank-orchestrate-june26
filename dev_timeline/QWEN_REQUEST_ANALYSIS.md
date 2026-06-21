# Qwen Request Options and Reasoning Analysis

This report inspects the available Ollama API request options and discusses how we can control visual reasoning overhead and token consumption during local visual verification.

---

## 1. Core Ollama Request Options

Ollama provides a dictionary of model parameters via the `options` field in `/api/chat` requests. Below are the key settings relevant to optimizing our visual pipeline:

| Parameter | Type | Default | Description | Impact on Latency / Accuracy |
| :--- | :--- | :--- | :--- | :--- |
| **`num_predict`** | `integer` | `-1` (infinite) or `2048` | The maximum number of tokens to generate in the model response. | Setting `num_predict: 100` truncates lengthy chain-of-thought generations, cutting latencies by up to **90%** if the model starts with CoT. |
| **`temperature`** | `float` | `0.8` | Controls the creativity and randomness of the model predictions. | Setting `temperature: 0.0` ensures maximum determinism and consistency, forcing greedy decoding which is critical for structured JSON validation. |
| **`top_p`** | `float` | `0.9` | Nucleus sampling parameter. Reduces the set of sampled tokens to those with cumulative probability `top_p`. | When `temperature: 0.0` is used, `top_p` is ignored by the greedy decoding algorithm. |

---

## 2. Thinking & Reasoning Settings in Ollama

Some local models (like `deepseek-r1` or customized `qwen2.5` variants) support Chain-of-Thought (CoT) reasoning. They generate reasoning steps enclosed in `<think> ... </think>` tags before returning the final response.

### A. Ollama Internal Parser
For models that output thinking blocks, Ollama strips the text inside the `<think>` tags and populates a dedicated `"thinking"` field in the response JSON, leaving the actual content inside `"content"`:
```json
{
  "message": {
    "role": "assistant",
    "content": "{ \"visible_part\": ... }",
    "thinking": "The claim is about... let's check the bumper..."
  }
}
```
However, **both fields count against the total generated tokens**. If a model outputs 2,000 tokens of thought and 50 tokens of JSON, it will consume 2,050 output tokens, taking massive amounts of CPU decode time.

### B. Methods to Omit / Control Reasoning Overhead in Ollama
1. **Instruct-level Disabling (Prompt Constraints):**  
   Instructing the model to skip explanations and start directly with the JSON opening brace:
   > *"Return ONLY the raw JSON object. Do not include any explanations, reasoning, or markdown blocks. Start directly with '{'."*
2. **Stop Tokens:**  
   Setting `<think>` or `</think>` as stop sequences in the request options:
   `options: { stop: ["<think>", "</think>", "\n\n"] }`
   If the model attempts to start reasoning inside a `<think>` block, it is aborted immediately, saving token generation costs.
3. **Hard Generation Cap (`num_predict`):**  
   Restricting the output size using `num_predict: 100` forces the request to end quickly, preventing long-winded thinking loops from consuming runtime resources.
