---
title: "How to verify an AI API rewrite"
description: "A checklist for testing an AI API rewrite with scripted model replies, shadow traffic and a canary before switching clients to the new service."
date: 2026-11-25
byline: "Innocent Ncube, based in Poland"
tags: [ai, developers]
draft: false
image: ""
---

A rewritten AI API can return `200 OK` while quietly changing the prompt sent to the model. It can also return the same final text and still break a client that reads the stream. A passing test suite tells you which cases you checked. The cutover depends on which behaviours clients rely on.

On 25 November, Anthropic described how it moved its Messages API from Python to Rust. In April the Rust version passed about 98% of its tests, while only about a quarter of the model inputs compared on production traffic matched. Those figures describe different samples. The production comparison exposed cases the suite had missed, including a difference in how the two implementations escaped characters in tool-call JSON before sending it to the model. [Anthropic’s migration write-up](https://www.anthropic.com/research/migrating-api-to-rust)

If you own a gateway that prepares model inputs and streams replies to clients, start with one route. Give the old and new implementations the same request, hold the model output fixed, then check what each implementation does on either side of the model call. Use what you find to decide whether that route is ready for a canary.

## 1. Write the contract at the HTTP boundary

Pick a route that carries real work, such as a streaming chat endpoint with tool calls. Run the same client tests against both deployments. Make the base URL a parameter and keep the expected behaviour in one place so a change to the rewrite cannot quietly relax its own checks.

- **Request handling.** Check which inputs are accepted, which defaults are applied, and which status and error body an invalid request gets. Include the client versions you still support.
- **Model input.** Compare the resolved model, prompt, tool definitions and generation settings. Compare the serialised input where representation can affect what the model sees. A JSON parser can treat two representations as equivalent while the model receives different text.
- **Response handling.** Check status, contract headers, event order, the reconstructed tool arguments and how the stream ends. Exercise an SDK that your customers use as well as the HTTP interface.

Make exceptions field by field. A request ID may differ between runs, but still needs to have the expected format and remain consistent wherever that request refers to it. Give each intentional change an owner and a test for the new behaviour. The old service is your starting point for comparison. The client contract decides which differences matter.

## 2. Give both versions the same model reply

Record the input each version would send to the model. Then feed both versions the same scripted reply at the model boundary. Start with a short text stream, a tool call whose arguments arrive in pieces, and a stream that ends in an upstream error. Keep the error and disconnect cases separate so a client can tell a failed reply from a completed one.

For a tool-call fixture, split the JSON arguments across events and check that the supported SDK assembles the complete object. Check when it considers the call ready to use. A test that only compares the final text has no assertion for either behaviour. Claude’s streaming documentation gives an example protocol with separate events for the start, updates and end of each content block. [Claude streaming documentation](https://platform.claude.com/docs/en/build-with-claude/streaming)

Keep the fixtures small enough to read in a review. When you find a mismatch, make one synthetic request or reply that reproduces it, then put that case back into the shared suite. If a new model is also part of the rollout, qualify it in a separate evaluation so you can attribute a regression to the right change.

## 3. Shadow traffic with side effects disabled

Once the fixtures pass, let the existing service answer clients and send a bounded sample to the candidate for comparison. Traffic mirroring tools can do this outside the primary request path. Istio, for example, discards the mirrored response, so you still need instrumentation to compare the paths. [Istio mirroring documentation](https://istio.io/latest/docs/tasks/traffic-management/mirroring/)

Before enabling the mirror, give the candidate stubs or isolated sinks for billing, quota writes, database updates and tool execution. Verify that a shadow request leaves the customer’s state untouched. For a paired output check, call the live model once and pass its output to the other implementation, as Anthropic did. Keep this comparison within the approved data boundary and record mismatch categories and counts. Use synthetic fixtures for debugging that requires seeing content. [Anthropic’s verification approach](https://www.anthropic.com/research/migrating-api-to-rust#how-we-verified-the-migration)

Count eligible requests, completed comparisons and dropped samples alongside mismatches. Break those figures down by route, client version and response mode. A quiet comparison dashboard is hard to trust if the candidate is dropping the streams you meant to check.

## 4. Decide what earns the next traffic step

Set the stop conditions before routing a small share of real requests to the new service. An unexplained change in a supported response contract or an incorrect charge should stop the rollout. Agree service-specific limits for error rate, time to first token and stream completion, then compare the canary with the old service over the same period. A site-wide average can hide a regression confined to the canary. [Google’s SRE workbook on canarying](https://sre.google/workbook/canarying-releases/)

Rehearse switching new requests back. Decide how the routing layer will drain in-flight streams and check that the old service can read any state the candidate has written. Give someone on call the authority to stop the rollout and a dashboard that shows whether the rollback took effect.

## The cutover checklist

- **Client contract.** The same HTTP and SDK assertions pass against both versions.
- **Model boundary.** The resolved input matches and scripted replies exercise stream and error handling.
- **Shadow traffic.** Side effects are isolated and comparison coverage is visible by client and response mode.
- **Canary.** The owner can compare the two versions and has rehearsed rollback.

## Conclusion

Take one route this week and build the check around a scripted tool reply. Run the same client against both versions and account for each difference before you add another route. By the time real traffic reaches the candidate, you should know which behaviours matter, how you will spot a regression and who can switch traffic back.

*If this was useful, Signal Tech sends a five-minute Friday briefing on AI engineering, chips and dev tools. You can* [*subscribe free on beehiiv*](https://dailysignaltech.beehiiv.com/?utm_source=signaltechnews&utm_medium=blog&utm_campaign=ai-api-rewrite-parity-checklist).
