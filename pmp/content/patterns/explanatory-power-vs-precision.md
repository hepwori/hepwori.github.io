---
title: Explanatory Power vs Precision
also_known_as: Fidelity Tuning, Resolution Matching
category: meaning-and-communication
summary: The trade-off between clarity and detail in communication.
---

## Context

Product managers, designers, and technical leaders communicate across audiences with vastly different levels of domain knowledge, context, and attention. Each layer of the organization has its own cognitive resolution—the level of detail it can meaningfully process before the message loses coherence.

The communicator must constantly balance **explanatory power** (breadth, clarity, narrative accessibility) against **precision** (specificity, exactness, technical truth). Too much explanatory power, and the message becomes hand-wavy or misleading. Too much precision, and it becomes impenetrable or irrelevant.

## Problem

Communication that is either too abstract or too precise fails to achieve its purpose. A story that persuades but oversimplifies creates misalignment later; a detailed explanation that is accurate but inaccessible stalls decisions. The art lies in knowing how much fidelity the audience actually needs.

## Forces

- **Cognitive resolution:** Different audiences perceive meaning at different levels of granularity.
- **Compression vs fidelity:** Simplification increases accessibility but erodes nuance.
- **Temporal asymmetry:** Early-stage discussions reward explanatory power; late-stage execution demands precision.
- **Legibility pressure:** People reward clarity more than correctness—until the errors bite.
- **Context drift:** Messages propagate through multiple layers, each reinterpreting them at its own resolution.

## Examples

- An executive update that uses metaphors to convey direction (high explanatory power, low precision).
- A PRD that enumerates API contracts and edge cases (high precision, low explanatory power).

**Resolution Mismatch — The Misaligned Roadmap Review:** A PM presents the next-quarter roadmap to executives using the same deck designed for sprint planning. It includes ticket numbers, dependency charts, and technical debt items—maximum precision, minimum explanatory power. Executives disengage, unable to parse the context or story, while the PM perceives their high-level questions as naive. Both sides believe the other "doesn't get it," when in fact they are communicating at mismatched cognitive resolutions.

**Resolution Mismatch — The Designer's Prototype Review:** A designer presents a narrative-rich prototype review doc to engineers, full of metaphors and storyboards. Engineers ask for clear specifications—they need precision, not narrative. The result is mutual frustration born of operating at different communicative fidelities.

## Navigation Strategies

Tune the fidelity of communication deliberately to the audience's cognitive resolution. Ask: What resolution can this audience actually interpret without distortion or loss?

- Begin with *why* (high explanatory power) to establish shared grounding.
- Move toward *how* (high precision) as the conversation approaches execution.
- Use layers: summaries for low-resolution readers, detail for high-resolution readers.
- Make explicit what has been simplified, and where further precision is available.

Good communicators don't choose between truth and clarity—they sequence them.

## Consequences

- Communication tuned to the wrong resolution confuses or alienates the audience.
- Teams talk past one another when operating at mismatched fidelities.
- Over time, organizations drift toward over-simplified narratives or over-engineered documents.
- Conscious fidelity tuning builds shared understanding faster and reduces rework.

## Known Uses

- Executive storytelling and technical documentation practices.
- Product reviews where the same content is presented at multiple levels of abstraction.
- Design critique culture that uses prototypes of varying fidelity to elicit the right kind of feedback.

## Related Patterns

- [[Dual Competence]] — balancing skill in the product system and the organizational system.
- [[Reward Loop Asymmetry]] — short-term incentives for clarity vs. long-term incentives for correctness.
- [[Cultural Dialects]] — how different subcultures within an organization process meaning at different resolutions.
