---
title: "Local vs cloud AI coding assistants: when to keep code on your machine"
description: "When a local AI coding assistant should keep code on your machine, and when a cloud assistant is still the better call for solo builders and small teams."
date: 2026-11-05
tags: [ai, coding-assistants, local-llm, privacy, developers]
draft: false
image: ""
---

Not every coding assistant should see your repo. A cloud assistant is convenient: a strong model, already in the editor, ready to read the files you point at. A local assistant matters when the code cannot leave the machine, when the network is absent, or when an agent loop has started to show up on the bill.

This is a decision guide for solo builders and small teams, not a ranking of products. The constraints that matter are data, cost, and model quality, plus the hardware you actually have. Latency and a RAM floor matter more than a logo.

For this task, does the code need to stay here, and is a weaker on-device model good enough to finish it? If yes, keep it local. If the task is hard, wide, or depends on tools you only have in a hosted agent, use the cloud on purpose and review the result. Once a diff exists, the review habit is the same either way. That pass is in [How to review AI agent pull requests without becoming the bottleneck](/blog/how-to-review-ai-agent-pull-requests).

## The real constraints: data, cost, and model quality

Three limits decide the choice.

**Data.** A cloud assistant sends something off the machine: the prompt, the files you attach, and often extra context the tool adds. That can be fine for a public repo or a toy example. It is a different decision for an unreleased product, a client tree, or a fixture full of customer rows. "Local" means the model runs on your hardware. It does not prove the app never phones home for telemetry or a download. Check that once before you trust it with a private tree.

**Cost.** A seat looks predictable until an agent re-reads the repository. Pasting a whole service, asking again, then letting a retry loop do it a third time is how a quiet afternoon becomes the expensive one. A local model moves the cost onto hardware, electricity, and slower answers, and it stops charging per retry. For a solo builder that is often the point. For a small team it keeps an experiment off a shared, uncapped key.

**Model quality.** Hosted models are usually better at long context, ambiguous design, and tool use. Small local models are often good enough for a rename, a test, a comment, or a mechanical edit in the open file. They drift on "rethink this boundary" or "this bug crosses three services".

A local diff and a cloud diff can both be confident and wrong. Quality changes how much you lean on the draft. It does not change who signs it.

## When local wins (compliance, IP, offline, predictable spend)

Local wins when leaving the machine is the expensive failure, not the slow answer.

**Compliance.** Some work has a plain rule: source does not leave this network. A client agreement, a lab, a regulated team, an air-gapped build box. If that rule is real, a cloud assistant is out unless you have read a written arrangement that says otherwise. The default habit should be the one that cannot attach the wrong folder by accident.

**Intellectual property and secrets.** An unreleased product, a private key, a `.env` file, a database dump used as a fixture, an internal URL. These do not belong in a prompt. "The vendor says they do not train on this" is a weaker guarantee than "the bytes never go". A local assistant can still write a secret into a commit, so the review pass still asks about secrets. Local reduces exposure. It does not replace a look at the diff.

**Offline, and a spend you can see.** On a flight, a locked-down customer site, or a tether you do not trust, a model already on disk still works. A local assistant also cannot surprise you with a usage invoice. A too-small machine fails in front of you. A hosted loop fails later, as a bill.

[Issue #3](/issues/2026-10-30) is the Friday edition on agents. Its Tool of the Week was a free, open-source assistant for the Mac that runs on the machine. That is the shape of this category: useful for the files in front of you, not a claim that it out-thinks a hosted model. The week's source stories sit in the [weekly digests](/digests/).

## When cloud still wins (hard tasks, tools, multi-repo agents)

Cloud still wins when the task is wider than the open file, or when the assistant must use tools you do not want to rebuild on a laptop.

**Hard tasks.** A design you cannot hold in one function. A bug that lives in the contract between two services. A migration that must stay correct for old rows and new rows. A small local model will often sketch something plausible and miss the constraint you forgot to paste. A stronger hosted model is more likely to notice, if those cases are in the prompt. Use it for the question. Do not upload the repository "for context".

**Tools and several repos.** Some assistants run tests, edit many files, or drive a browser. That loop is useful, and it is how scope explodes. If the repo is one you may share, and the hosted agent already has the tools, it can be the faster path. Give it a goal and a boundary, then read the diff. An agent that must see a front end, an API, and a shared library is usually a cloud job today: the context is large and the stronger models are hosted. Split the work. Let the hosted model propose a plan from a short description and the public interfaces. Change each repo on its own, and review the diffs separately. A private monorepo is a high price for a tour you could have had from the README and two entry points.

Choose before you send, not after the invoice or the leak.

## Hardware floor and what "good enough" looks like in practice

People want a single number. The honest answer is a range, because the editor, the browser, and the model share the same RAM.

**Around 8GB.** The editor and a very small model can coexist if little else is open. An agent that reads several files will swap. Treat this as a fallback for a short, single-file edit.

**16GB and up.** This is often the floor for a usable local coding assistant next to a normal IDE. You can ask about the open file, generate a test, and rename a symbol, provided you are not also running a stack of containers and a dozen tabs. Long refactors start to crawl. If the reply takes longer than writing the change yourself, the setup is below the job.

**32GB, and a GPU if you have one.** More comfortable when the model, the IDE, a browser, and a local server all stay open. A discrete GPU helps a larger model finish sooner. Many solo builders will not have one, and integrated graphics can still run a small model. Free a full disk before you decide the model is bad.

**Good enough** is a test on a file you know. Ask for a failing test, then the implementation, then one comment on a tricky branch. If you can check it in a few minutes and keep most of it, the local model is earning its place. If you re-prompt more than you edit, the model is too small or the task is too wide. Move that task to the cloud. Skip the benchmark you have not run.

## A hybrid workflow that does not fight your IDE

The setup that survives a week is dull. One assistant lives in the editor. A second is a deliberate trip, not a second writer on the same file.

1. **Bind the daily assistant to the open file.** Prefer the local one on a private repo. Let it complete, explain the function under the cursor, and draft the test. Do not hand it the tree "just in case".
2. **Escalate with an excerpt.** When the local answer is thin, copy the function, the error, and the constraint. Send that. State what must not change. Leave secrets, customer rows, and internal hostnames out.
3. **One writer at a time.** A local agent and a hosted agent on the same files produce a mess you cannot attribute.
4. **Apply a small change yourself.** Paste it into the diff view you already trust. For a larger patch, use a branch and the same first pass you would use on a colleague: scope, secrets, tests, blast radius.
5. **Make the cloud one opt-in.** A plugin that sends context on every save is not a hybrid. It is a cloud assistant with a local sticker. The default should be quiet.

A small team needs one sentence in the README or the pull-request template: private repos stay on the machine unless the author says what they sent and why. That stops a plugin default from becoming the policy.

How we separate a vendor's claim from our own judgement is on the [editorial standards](/editorial). The assistant proposes. A person accepts. Who signs that judgement for the publication is on the [about page](/about).

## Decision table + next experiment for one week

Use the table as a default. Break it when you can say why.

| Situation | Prefer | Why |
| --- | --- | --- |
| Everyday edit in a private repo | Local | The open file is enough, and the code stays put |
| Secrets, customer data, or an unreleased product | Local | The failure is exposure, not a slower answer |
| A hard design, or a change across several repos | Cloud, then review | The stronger model earns an excerpt, not the tree |
| Offline, air-gapped, or a hard spend cap | Local | The hosted tool is unavailable or uncapped |
| A public example, or a question you can redact | Hybrid | Cloud for the hard part, local for the edit you commit |

**Try this for one week.** For five working days, label each request before you send it: local, cloud, or neither. Local gets the open file only. Cloud gets a redacted excerpt and a question, not the repository. Neither means you already know the change. Keep one line when the answer was wrong, or when you wanted to paste more than the excerpt.

Read the list on Friday. A local column of "had to redo this" means the hardware or the model is below the job. A cloud column of "I pasted the repo again" means the habit is the problem. A green local test and a fluent cloud explanation are both claims. You still own the merge.

Get chips, models and tools without the noise every Friday — free, about five minutes.
