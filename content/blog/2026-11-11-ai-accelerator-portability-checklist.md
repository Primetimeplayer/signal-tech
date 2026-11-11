---
title: "How to keep your AI stack portable across GPUs and TPUs: a practical checklist"
description: "A practical checklist for tech leads to keep AI training and serving portable across NVIDIA GPUs, AMD GPUs, Google TPUs and AWS Trainium."
date: 2026-11-11
byline: "Innocent Ncube, based in Poland"
draft: false
image: ""
---

For years, "which accelerator?" was a question most teams answered once. You picked NVIDIA, wrote CUDA-flavoured code, and moved on. That default is getting weaker.

In late October, [Oracle](https://www.oracle.com/news/announcement/ai-world-oracle-brings-google-tpus-to-oracle-cloud-infrastructure-2026-10-27/) and [Google](https://cloud.google.com/blog/products/infrastructure/bringing-google-tpus-to-oracle-cloud-infrastructure) announced that Google's Tensor Processing Units will be available on Oracle Cloud Infrastructure from calendar year 2027 — the first time TPUs will be offered on a hyperscale cloud outside Google. A week earlier, [Google open-sourced TorchTPU](https://cloud.google.com/blog/topics/ai-infrastructure/torchtpu-is-now-open-source-run-native-pytorch-on-tpus), a native PyTorch backend for TPUs, built with the PyTorch team at Meta. And [Anthropic's IPO filing](https://www.sec.gov/Archives/edgar/data/2130357/000162828026068676/anthropicpbc-sx1ax1.htm) describes a "multi-chip compute architecture across AWS Trainium, Google TPUs, NVIDIA GPUs, and AMD GPUs", and says it manages compute "as a single, fungible pool".

That was the theme of [Signal Tech Issue #4](/issues/2026-11-06): build for chip choice, not chip loyalty. You probably do not need a four-vendor compute pool. You do want switching accelerators to be a configuration and testing exercise, not a rewrite. This is a checklist for getting there, aimed at tech leads and engineers who train, fine-tune or serve models.

## Why portability is worth some effort now

- **More real options.** TPUs are moving beyond Google Cloud. Google says TorchTPU makes TPUs a native PyTorch option alongside GPUs and CPUs.
- **Price and queue leverage.** If your code only runs on one accelerator brand, that vendor's availability and pricing set your bill and your timelines.
- **Fast-moving hardware.** NVIDIA's [CUDA 13.5](https://developer.nvidia.com/blog/nvidia-cuda-13-5-brings-nvidia-vera-rubin-ga-support/), published this month, moved support for the Vera Rubin architecture from early access to general availability. Portable code makes it cheaper to try whichever generation, from whichever vendor, offers the better price or a freer queue.

Portability is not free, and it is not the same as peak performance on every chip. The aim is to keep the expensive, hard-to-move parts small and well fenced.

## 1. Stay on the framework's device abstraction

The cheapest portability win is not hard-coding the hardware.

- Pick the device from configuration, never with `.cuda()` or `"cuda"` sprinkled through model code. The [PyTorch blog on TorchTPU](https://pytorch.org/blog/introducing-torchtpu/) puts the basic migration as changing `.to("cuda")` to `.to("tpu")`. That only stays a small change if the device string lives in one place.
- Prefer the framework's accelerator helper where you have it. The same blog shows a device-agnostic pattern: `torch.accelerator.current_accelerator()` and `torch.distributed.init_process_group()` with no hard-coded backend, instead of pinning `"nccl"` or `"tpu_dist"` throughout the training script.
- Use standard PyTorch APIs: eager mode for debugging, `torch.compile` for performance, `torch.distributed` for scaling. [Google's Cloud TPU documentation](https://docs.cloud.google.com/tpu/docs/pytorch-on-tpu) says TorchTPU supports all three.
- If you still run PyTorch/XLA on TPUs, note that [Google's Cloud TPU documentation](https://docs.cloud.google.com/tpu/docs/pytorch-on-tpu) now says TorchTPU replaces PyTorch/XLA, and recommends starting new work on TorchTPU and migrating existing workloads.

One honest limit, also from the PyTorch blog: that device-string change should let a model *run*. It will not automatically deliver peak TPU performance, because shapes, sharding and ops may still be skewed towards a GPU. Treat "it runs" and "it is cheap enough to keep" as two separate checks.

## 2. Fence off custom kernels

Hand-written kernels are where portability usually dies.

- Keep custom kernels in a separate module behind a small interface, with a plain framework fallback that runs anywhere.
- Record which kernels exist for which back ends. The [PyTorch blog](https://pytorch.org/blog/introducing-torchtpu/) says TorchTPU lets you author custom kernels via JAX/Pallas (described as production-ready) and, experimentally, via the Helion DSL. On NVIDIA you may be using CUDA or CUDA Tile.
- Measure what each custom kernel actually buys you on your workload. If the fallback is close enough, the kernel may not be worth carrying on every platform.

## 3. Serve through an engine that supports several back ends

For inference, the serving engine is your biggest portability lever.

- [vLLM's installation docs](https://docs.vllm.ai/en/stable/getting_started/installation/) list NVIDIA CUDA, AMD ROCm, Intel XPU and CPUs among the platforms in the main project, and a hardware plugin system for accelerators that live outside that repository. Google documents a PyTorch-native TPU path as [vLLM-TorchTPU](https://docs.vllm.ai/projects/vllm-torchtpu/en/latest/) (with a separate JAX path alongside it). AWS Trainium is covered by the [vLLM Neuron plugin](https://github.com/vllm-project/vllm-neuron), which the project calls the recommended serving solution for large language models on Trainium.
- [Google says TorchTPU works with vLLM, SGLang, llm-d, TorchTitan, Ray and Hugging Face](https://cloud.google.com/blog/topics/ai-infrastructure/torchtpu-is-now-open-source-run-native-pytorch-on-tpus), so an existing vLLM or SGLang deployment has a documented path to TPUs.
- Keep your API layer (OpenAI-compatible endpoints, request schema, auth) independent of the engine and hardware underneath, so clients never notice a move.

## 4. Make model artefacts hardware-neutral

- Store canonical weights in a neutral format (for example, safetensors, following Hugging Face conventions) and treat compiled, quantised or hardware-specific builds as *derived* artefacts you can regenerate.
- Version your quantisation recipes as code. A recipe tuned for one chip's number formats may not carry over, so make re-running it cheap.
- Pin tokeniser and preprocessing versions so outputs stay comparable across platforms.

## 5. Test on more than one back end, continuously

Portability you do not test is portability you do not have.

- Add at least one non-primary back end to CI, even a small nightly job. CPU runs catch many device-hard-coding bugs for almost nothing.
- Compare outputs with sensible numerical tolerances rather than exact matches. Different hardware and compilers produce slightly different floating-point results, and default precision modes are not the same everywhere: the PyTorch blog notes that TorchTPU defaults to a "medium" mode (bfloat16 on the TPU's matrix units, with FP32 accumulation), whereas PyTorch on CUDA defaults to "highest" (pure FP32).
- Keep a short, fixed evaluation set and a throughput benchmark so you can compare cost per token or cost per training step across platforms on your own workload, not on vendor headline numbers.

## 6. Keep infrastructure and observability vendor-neutral

- Describe clusters and jobs with orchestration you already use (Kubernetes, Ray or similar) and keep accelerator type as a parameter.
- Track the metrics that decide cost. [Google's TPU-on-OCI announcement](https://cloud.google.com/blog/products/infrastructure/bringing-google-tpus-to-oracle-cloud-infrastructure) frames training economics around goodput (the share of time spent on productive computation) and inference around latency and cost per token. Those are useful, hardware-neutral yardsticks on any platform.
- Use vendor profilers for deep dives, but publish a common set of metrics to one dashboard.

## The checklist

| Area | Check | Done? |
|---|---|---|
| Code | Device chosen in config, no hard-coded `"cuda"` | ☐ |
| Code | Standard framework APIs (eager, `torch.compile`, `torch.distributed`) | ☐ |
| Kernels | Custom kernels isolated, with a portable fallback | ☐ |
| Serving | Engine supports at least two back ends you might use | ☐ |
| Serving | Client API independent of engine and hardware | ☐ |
| Artefacts | Canonical weights stored neutrally; hardware builds reproducible | ☐ |
| Testing | Nightly CI on a second back end (CPU counts) | ☐ |
| Testing | Fixed eval set plus throughput and cost benchmark | ☐ |
| Infra | Accelerator type is a deployment parameter | ☐ |
| Metrics | Goodput, latency and cost per token tracked per platform | ☐ |

## What not to do

- **Do not chase lowest-common-denominator code everywhere.** Optimise hot paths for your main platform, but keep them behind an interface.
- **Do not trust headline benchmarks.** Vendor figures are useful signals, but your model, batch sizes and sequence lengths decide the real result.
- **Do not plan around capacity that does not exist yet.** TPUs on OCI are due in calendar year 2027, ramping over several years. Pricing, first regions and year-one capacity were not disclosed in the announcement. Treat it as an option to prepare for, not a line in this quarter's budget.

## Conclusion

The lesson from this autumn's chip news is simple: build for chip choice, not chip loyalty. You do not need Anthropic's orchestration layer to benefit. Keeping device choice in config, fencing off custom kernels, serving through a multi-back-end engine and testing on a second platform will get most teams most of the way. The day a better price or a shorter queue appears elsewhere, moving should be a pull request, not a project.

*If this was useful, Signal Tech sends a five-minute Friday briefing on AI engineering, chips and dev tools. You can* [*subscribe free on beehiiv*](https://dailysignaltech.beehiiv.com/?utm_source=signaltechnews&utm_medium=blog&utm_campaign=ai-accelerator-portability-checklist).
