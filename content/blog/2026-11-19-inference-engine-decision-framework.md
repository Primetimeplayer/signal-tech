---
title: "How to choose (and switch) an inference engine without locking your team in: a practical decision framework"
description: "A practical guide to choosing an LLM inference engine, comparing cost and latency under load, and testing a switch before you need one."
date: 2026-11-19
byline: "Innocent Ncube, based in Poland"
draft: false
image: ""
---

An inference engine can look like an infrastructure choice until its chat templates, streaming events, and GPU assumptions make their way into your application. If you lead a team shipping an LLM feature, choose the engine that meets your workload today and prove that you can route the same requests to a second one. That second deployment will tell you where the lock-in actually lives.

## 1. Write down what the workload needs

Start with one production route. A chat assistant with long prompts and short answers has different needs from a batch extraction job that can run overnight. Give each workload its own targets.

- **Traffic.** Record typical and long-tail input and output lengths, peak concurrency, burst patterns, and how often requests share a prefix.
- **Latency.** Set a p95 time-to-first-token target for streaming, a target for the gap between tokens, and an end-to-end deadline. For batch jobs, specify how much work must finish by when.
- **Correctness.** List the model revision, context length, and behaviours you rely on, including JSON schema validation, tool calls, and streaming. Define what a successful response looks like.
- **Constraints.** Record the hardware you can provision, where data can be processed, and who will own upgrades, capacity, and incidents.

Treat these as gates. If a candidate can’t reliably return valid tool arguments or fit your longest supported request at target concurrency, a higher tokens-per-second result won’t get it into production.

## 2. Shortlist two engines

Pick a baseline and one credible alternative. Put the rest aside until you have a reason to test them.

| Option | When to try it | What to verify |
| --- | --- | --- |
| **vLLM** | You want a baseline for shared GPU serving with an OpenAI-compatible API. | Check the exact model, quantisation, and serving features on your target accelerator. CUDA and ROCm support are a starting point. [API docs](https://docs.vllm.ai/en/stable/serving/online_serving/openai_compatible_server/) · [GPU support](https://docs.vllm.ai/en/stable/getting_started/installation/gpu/index.html) |
| **TensorRT-LLM** | You expect to stay on NVIDIA for this workload and have enough traffic to justify tuning for a specific GPU and precision. | Pin the release before benchmarking. NVIDIA’s current migration guide documents removal of the legacy TensorRT engine backend, so older build instructions can send you down the wrong path. [NVIDIA migration guide](https://nvidia.github.io/TensorRT-LLM/latest/legacy/tensorrt-backend-removal.html) |
| **TGI** | An existing deployment meets its targets and moving it today would interrupt higher-priority work. | Hugging Face puts TGI in maintenance mode and recommends alternatives such as vLLM and SGLang. Set a migration trigger if model support, fixes, or platform compatibility become a problem. [Hugging Face documentation](https://huggingface.co/docs/text-generation-inference/en/index) |
| **llama.cpp / llamafile** | You’re serving a quantised model locally, on a workstation, or on a small edge deployment. Use `llama-server` for a network interface or evaluate llamafile when single-file distribution matters. | Measure memory use and generation speed on the machine that will run it. Keep the GGUF file reproducible from your upstream checkpoint where licensing permits. [llama.cpp](https://github.com/ggml-org/llama.cpp) · [llamafile](https://github.com/mozilla-ai/llamafile) |
| **SGLang** | Your application repeatedly sends long shared prefixes, such as stable system prompts or tool definitions. | Measure prefix reuse with realistic traffic, including cold requests and concurrent tenants. Test the model and the structured outputs your application actually consumes. [SGLang documentation](https://github.com/sgl-project/sglang) |
| **Managed endpoint** | Your team needs to ship without owning the serving fleet, or traffic is intermittent enough to test usage-based capacity. | Check cold starts, minimum replicas, quotas, model revision controls, data retention, and what you can export. Dedicated capacity and scale-to-zero have different cost and latency profiles. [AWS serverless inference documentation](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html) |

## 3. Compare work that meets your targets

Replay the same sanitised requests, arrival pattern, and output limits. Keep the model revision, tokenizer, and precision fixed for the first comparison where possible. If a candidate needs different weights or quantisation, record that difference and rerun the quality checks before comparing cost.

1. **Run warm and cold tests.** Include a steady load, a burst, and a cold replica. Record p95 first-token and end-to-end latency alongside errors, timeouts, and queue depth. A run built around one repeated prompt can overstate the benefit of prefix caching.
2. **Count usable throughput.** Increase load until the system misses a latency, quality, or error-rate target. Compare successful requests per second below that point. For extraction, count responses that pass schema validation. For tool calling, count valid tool names and arguments.
3. **Price the whole run.** Divide total serving cost by the number of requests that met your targets. Include idle replicas, spare capacity, managed fees, and relevant network charges. Keep operations effort visible alongside that figure. Someone still has to patch, monitor, and roll back the service.
4. **Test one failure.** Restart a replica under load or hit a known quota in staging. Check how quickly capacity returns and whether clients cancel, time out, or pile on retries.

## 4. Keep the parts you’ll need to switch

Use an OpenAI-compatible API as a starting point, then put a small adapter between it and your application. Keep the model alias, endpoint, credentials, and engine-specific settings behind that boundary. Write contract tests for the few behaviours you depend on, including streamed tool arguments, finish reasons, stop sequences, and errors. Matching route names makes the first call easier. Your tests establish whether the response is safe to consume.

Keep three things under your control.

- **Model artefacts.** Pin the source weights, tokenizer, chat template, and generation defaults. Keep conversion commands and checksums for GGUF files, quantised weights, and proprietary engine artefacts. If a provider won’t let you export weights or pin a revision, qualify your fallback as a model change and rerun the quality evaluation.
- **Deployment artefacts.** Pin the engine image by digest and record the host driver and accelerator requirements. Use separate images where the hardware stack requires them. Keep custom CUDA kernels and vendor-specific optimisations in the serving layer, with a tested fallback for the features you need.
- **Traffic controls.** Put the backend choice in configuration. Replay requests in staging, then send a small share of live traffic to the candidate. Agree on rollback thresholds before the canary. Keep in-flight streams on their original backend, and keep the old deployment warm until you’ve tested switching traffic back.

## Decision checklist for this week

| Check | Done? |
| --- | --- |
| We chose one workload and wrote down its latency, quality, and error-rate targets. | ☐ |
| Two candidates can handle the longest supported request and the API features we use. | ☐ |
| We measured cost per successful request under realistic load, including idle capacity. | ☐ |
| We know which weights, kernels, and provider features would have to change if we moved. | ☐ |
| We can switch backends in staging and roll back without shipping application code. | ☐ |

## What to do next

1. Pick one production route and build a small, sanitised replay set.
2. Run your current backend and one alternative through the same load and contract tests.
3. Write a one-page decision record with the winning configuration, its dependencies, and the conditions that would trigger a switch.
4. Assign an owner to rehearse the switch and rollback in staging before the next major model or hardware change.
