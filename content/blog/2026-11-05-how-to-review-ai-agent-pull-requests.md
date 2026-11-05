---
title: "How to review AI agent pull requests without becoming the bottleneck"
description: "Practical review for AI coding agent pull requests: a ten-minute first pass, the deeper checks worth your time, and which calls only a human should sign."
date: 2026-11-05
tags: [ai, agents, code-review, pull-requests, developers]
draft: false
image: ""
---

Agents open the pull request. You still own the merge. Most teams miss that split in one of two ways.

Some rubber-stamp a green suite. Others read every line, and the queue becomes the work. Neither scales when an agent can open five pull requests before lunch.

Review the decision, then the diff. If you cannot say what the change is for in one sentence, do not approve it. The agents theme is in [Issue #3](/issues/2026-10-30), the source stories sit in the [weekly digests](/digests/), and the [editorial standards](/editorial) are how we separate a claim from a judgement.

Where the agent ran is a separate choice. A model on your machine and a hosted one can both produce a tidy, wrong diff. That trade-off is in [Local vs cloud AI coding assistants: when to keep code on your machine](/blog/local-vs-cloud-ai-coding-assistants). Once the diff exists, the review is the same either way.

## Why agent PRs fail differently from human PRs

A colleague knows which files they meant to touch. An agent will also tidy a neighbouring module, rename a helper, or add a dependency you did not ask for. That is a different failure from a sloppy human mistake: the change looks plausible line by line and is wrong in the system around it.

A human leaves a rough edge where they were unsure. An agent fills the gap. A new helper, a wider type, a retry, a library pulled in for one call. Each of those is a decision. None of them was in the task. The pull request description is written by the same model, so it will sound sure about a change the diff does not make, or stay quiet about the file that matters.

Tests can freeze the wrong behaviour. A snapshot of whatever the agent printed will pass forever, and it never asks whether that output was the requirement. A green run then protects the invention.

A forty-line fix can arrive inside four hundred lines of reformatting. Treat unexpected files as a defect, not as free cleanup. The failure is not that the code "looks generated". The failure is a diff that is locally tidy and globally unasked for. If you cannot point at the decision, you are reviewing prose, not a change.

## A 10-minute first pass (scope, secrets, tests, blast radius)

Set a timer and answer four questions. Spend the ten minutes on the edges of the diff, not on style. If you cannot tell, send it back with that sentence. Do not review a pull request whose edges you cannot see. If the honest answer is "I would have to read the whole repository", that is a fail.

1. **Scope.** Does the diff match the task, or did the agent wander?
2. **Secrets.** Any new tokens, `.env` files, logged credentials, or a wider permission?
3. **Tests.** Is there a test for the behaviour you care about, and does it fail if that behaviour is removed?
4. **Blast radius.** Which services, migrations, or users does this touch if it is wrong?

**Scope fails** when a formatter sweep covers the package, a renamed helper updates every caller, a new dependency appears for one function, or a file the task never named is in the diff. The real edit is often twenty lines you cannot see because of the noise around it.

Write back: "Keep only the files that implement the task. Revert the rename, the formatter sweep, and the new dependency. Open anything else as its own change, or drop it."

**Secrets fail** when a `.env` or a fixture holds a live-looking token, a log line prints an `Authorization` header, a test copies a key out of a comment, or a role grew "so the job could run". A sample value that looks real is still a fail until you know it is fake.

Write back: "Remove the secret from this branch, including the fixture. Rotate it if it was ever real. Log a request id, not headers or bodies. Put the old permission back."

**Tests fail** when there is no test, when the test only asserts that a function does not throw, when the test mocks the function that changed, when a snapshot covers a whole file, or when the test would still pass if you deleted the feature.

Write back: "Add a test that fails when this behaviour is removed. Cover an empty input and a duplicate. Do not mock the function this pull request changes."

**Blast radius fails** when a migration has no note of what a second run does, a shared client used by more than one service changes shape, a default flips from off to on, or a consumer changes while the producer still sends the old payload.

Write back: "Name the callers. If this is wrong, who sees it on the first request? Keep the new behaviour behind the existing flag, default off. Put the migration in its own pull request."

Stop when one answer is no. Another pass on a diff you have already decided to send back is how the queue becomes the work.

## Deep checks worth the time (correctness, security, idempotency)

Use the longer pass only after the first one. You are no longer asking whether the diff is the task. You are asking whether the task, as implemented, survives the cases an agent tends to skip. Check the empty, duplicate, and partial cases. Check that auth stayed in place, that queries are parameterised, and that nothing new sits on a public route.

**Correctness**

- Empty, missing, and one-item inputs, not only the happy row.
- The same event delivered twice.
- A loop that fails on the third item, and what is left of the first two.
- A boundary you can name: an inclusive end date, a zero quantity, a clock near midnight.
- Callers that still send the old shape.

**Security**

- The route still checks auth. A handler added "for the test" is not public by accident.
- Queries and shell commands are parameterised. User input is not concatenated into them.
- A permission, a role, or a token scope did not grow to make the suite green.
- Input that reaches a path, a redirect, or HTML is allow-listed or escaped.
- Errors do not echo secrets, stack paths, or internal hostnames.

**Idempotency**

- A job, a webhook, or a migration is safe to run twice, because agents love a retry.
- A create that already exists returns the first row. It does not insert another.
- A retry does not send the email, take the payment, or fire the outbound call again.
- A migration that adds a column does nothing harmful when the column is already there.
- The "already done" mark is written so a second run can see it, or the side effect itself is safe to repeat.

A test that only asserts "does not throw" is not a claim. Ask what would still pass if the feature were deleted. If the answer is "the new test", the test is documenting the agent, not the requirement.

## What to automate vs what only a human should sign

Automate formatting, type checks, secret scanning, and a warning when the diff leaves the task. Label pull requests that change auth, payments, or migrations so they land in the slow queue on purpose. The machine should refuse the boring failures before a person opens the diff.

| Decision | Who | Why |
| --- | --- | --- |
| Formatting, types, lint, secret scan | Automate | A person will not catch these reliably at speed |
| Diff leaves the paths named in the task | Automate a warning | Unexpected files are a defect, not a bonus |
| Auth, payments, or a migration | Label it, then a human | These belong in the slow queue on purpose |
| Intent, and the risk if it is wrong | Human | The suite cannot see what the change is for |
| Deletes data, or changes a public contract | Human | A summary from the agent is not a sign-off |

A human still signs the intent, the risk, and anything that deletes data or changes a public contract. An agent's own summary is a claim, not a review. Who signs our judgement is on the [about page](/about). The same split applies in the repository: the tool proposes, a person accepts.

Do not automate the approval. A required check can block a merge. It cannot decide that the merge is the change you asked for.

## Team habits: review queues, ownership, and "approve with comments" rules

Give the queue an owner for the day, and cap how many agent pull requests can sit open. More than that cap is waste, not speed.

The owner is not the person who merges everything. They notice a pull request that has sat past the cap, and they send it back or close it. A small team can start at two or three open agent pull requests per repository. The number matters less than enforcing it. A fifth pull request that is "almost done" is how the queue becomes the work. Close the stale one. The agent can open it again from a smaller task.

"Approve with comments" is for a name, a missing comment, or a follow-up that can wait. If the comment would block a colleague, it blocks the agent.

Fine to approve, and say so in the note:

- A name, a comment, or a log line that is noisy but safe.
- A follow-up for a refactor the task did not ask for, after the extra files are reverted or split out.
- A typo in a string the test already covers.

Not fine. Request changes:

- A missing test for the behaviour you care about.
- A secret, a wider permission, or a new public route.
- A migration, a payment, or a contract change you have not read.
- A scope you still cannot say in one sentence.

One line is enough for the next run to fix it without a meeting. Write it as an instruction: the path, the behaviour, and what to leave alone. "Looks good, just double-check" gives the next run nothing to apply.

## What to practise this week

Add the ten-minute pass to one repository's pull request template. On the next five agent pull requests, note which of the four questions failed. That list is your review policy.

Write the send-back sentence next to the question, in the same note. After five you will see a pattern: scope on three of them, tests on the other two, or a secret once. Change the template and the instructions you give the agent for the pattern you actually saw. Do not add a checklist line for a failure that did not happen.

Get one Big Signal, quick hits and a Tool of the Week every Friday — free, about five minutes.
