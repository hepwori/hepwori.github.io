---
title: Reward Loop Asymmetry
also_known_as: Temporal Myopia, Short-Term Rationality
category: systems-and-incentives
summary: The tendency for short-term, visible rewards to dominate behavior.
---

## Context

Organizations depend on feedback loops—mechanisms that connect actions to rewards. The timing and visibility of these loops profoundly shape behavior.

Short feedback loops (like sprint velocity, quarterly OKRs, or year-end risk reduction targets) generate fast, legible signals. Long feedback loops (like resilience, architecture, or reputation) evolve slowly and are difficult to attribute.

When short and long loops coexist but are rewarded asymmetrically, the system biases toward the short term. Individuals act rationally within their incentives, even when doing so undermines collective or strategic outcomes.

## Problem

Teams optimize for what is rewarded most reliably, not what is most valuable. The organization's nervous system reacts more strongly to proximal, visible, and quantifiable feedback than to distant, ambiguous, and qualitative signals.

As a result, the system selects for short-term wins, visible progress, and metric improvement—even when these come at the expense of durability or long-term health.

## Example: The Cybersecurity Deadline

A cybersecurity function is given an aggressive target for risk reduction by year-end. The metric is the number of remediated vulnerabilities or reduced exposure across key systems.

Any work not expected to deliver visible, measurable risk reduction by the deadline is deprioritized. Platform hardening, automation, and design improvements—initiatives that would prevent future risk—are postponed because their benefits will not register before the reporting window closes.

By December, the metrics look good: short-term risk appears reduced. But systemic vulnerabilities remain, and the platform work that would have improved long-term resilience has been deferred. The team has behaved perfectly rationally inside a distorted reward loop.

## Forces

- **Temporal asymmetry:** Short feedback loops dominate attention and resourcing; long loops fade into abstraction.
- **Legibility bias:** Measurable progress is more persuasive than intangible progress.
- **Attribution difficulty:** Success from long-loop work is hard to credit to individuals or teams.
- **Leadership horizon:** Reporting cycles and tenure lengths amplify short-loop pressure.
- **Cultural impatience:** Organizations accustomed to speed confuse fast motion with sustainable momentum.

## Navigation Strategies

Design reward systems that acknowledge the existence of multiple feedback horizons.

- Pair every short-loop metric with a balancing long-loop indicator (e.g., velocity vs. stability, risk reduction vs. resilience).
- Reward **investment behavior**, not only investment outcomes.
- Create institutional memory for long-loop effects through documentation and storytelling.
- Ensure leadership explicitly values invisible or deferred progress during reviews and planning.
- Audit the organization's feedback topology annually: what time horizons are being heard? What's silent?

## Consequences

- Strategic work becomes irrational within local incentive structures.
- Teams converge on measurable but shallow improvements.
- Platform, tooling, and capability investments atrophy.
- Over time, the organization grows fragile—efficient in the short term, brittle in the long term.

## Known Uses

- Risk reduction targets in cybersecurity and compliance programs.
- Product roadmaps optimized for quarterly OKRs at the expense of architectural health.
- Growth metrics privileging acquisition over retention.
- Performance systems rewarding delivery frequency rather than cumulative impact.

## Related Patterns

- [[Perverse Correlation]] — when metric meaning inverts as it becomes a target.
- [[Dual Competence]] — navigating between craft quality and system fluency, including incentive literacy.
- [[Fluency Capture]] — the organizational state produced when reward loop asymmetry persistently selects for fluency over craft.
- [[Absence Accounting]] — reward loop asymmetry applied specifically to preventive work, where the ledger structurally cannot record what didn't happen.
