---
title: "How to review AI agent pull requests without becoming the bottleneck"
description: "How to review pull requests written by AI coding agents, with a ten-minute first pass, the checks worth your time, and which calls only a human should sign."
date: 2026-11-05
tags: [ai, agents, code-review, developers]
draft: false
image: ""
---

Agents open the pull request. You still own the merge. Most teams miss that split in one of two ways.

Some rubber-stamp a green suite. Others read every line, and the queue becomes the work. Neither scales when an agent can open five pull requests before lunch.

Review the decision, then the diff. If you cannot say what the change is for in one sentence, do not approve it. The agents theme is in [Issue #3](/issues/), the source stories sit in the [weekly digests](/digests/), and the [editorial standards](/editorial) are how we separate a claim from a judgement.

## Why agent PRs fail differently from human PRs

A colleague knows which files they meant to touch. An agent will also tidy a neighbouring module, rename a helper, or add a dependency you did not ask for. That is a different failure from a sloppy human mistake: the change looks plausible line by line and is wrong in the system around it.

A forty-line fix can arrive inside four hundred lines of reformatting. Treat unexpected files as a defect, not as free cleanup.

## A 10-minute first pass (scope, secrets, tests, blast radius)

Set a timer and answer four questions.

1. **Scope.** Does the diff match the task, or did the agent wander?
2. **Secrets.** Any new tokens, `.env` files, logged credentials, or a wider permission?
3. **Tests.** Is there a test for the behaviour you care about, and does it fail if that behaviour is removed?
4. **Blast radius.** Which services, migrations, or users does this touch if it is wrong?

If you cannot tell, send it back with that sentence. Do not review a pull request whose edges you cannot see.

## Deep checks worth the time (correctness, security, idempotency)

Use the longer pass only after the first one. Check the empty, duplicate, and partial cases. Check that auth stayed in place, that queries are parameterised, and that nothing new sits on a public route. A job, a webhook, or a migration should be safe to run twice, because agents love a retry.

A test that only asserts "does not throw" is not a claim. Ask what would still pass if the feature were deleted.

## What to automate vs what only a human should sign

Automate formatting, type checks, secret scanning, and a warning when the diff leaves the task. Label pull requests that change auth, payments, or migrations so they land in the slow queue on purpose.

A human still signs the intent, the risk, and anything that deletes data or changes a public contract. An agent's own summary is a claim, not a review. Who signs our judgement is on the [about page](/about). The same split applies in the repository: the tool proposes, a person accepts.

## Team habits: review queues, ownership, and "approve with comments" rules

Give the queue an owner for the day, and cap how many agent pull requests can sit open. More than that cap is waste, not speed.

"Approve with comments" is for a name, a missing comment, or a follow-up that can wait. If the comment would block a colleague, it blocks the agent. One line is enough for the next run to fix it without a meeting.

## What to practise this week

Add the ten-minute pass to one repository's pull request template. On the next five agent pull requests, note which of the four questions failed. That list is your review policy.

Get one Big Signal, quick hits and a Tool of the Week every Friday — free, about five minutes.
