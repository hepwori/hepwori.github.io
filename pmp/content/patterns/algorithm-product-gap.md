---
title: Algorithm–Product Gap
also_known_as: Model ≠ Product, The Interpretability Divide
category: product-and-user
summary: The disconnect between a model's technical success and its value to users.
---

## Context

As products increasingly incorporate machine learning and automation, technical success and product success often diverge. Teams celebrate model accuracy, but users experience confusion, loss of control, or mistrust. The system performs correctly, yet doesn't satisfy.

This pattern captures the structural misalignment between algorithmic optimization and human experience—and the work required to bridge it.

## Problem

Optimizing an algorithm's performance doesn't guarantee product value. Statistical correctness can conflict with user expectations, domain norms, or emotional resonance. When automated systems act without legibility, users perceive them as arbitrary—even hostile.

The deeper issue: algorithms optimize for metrics; products optimize for meaning.

## Example

At Stripe, a fraud-detection model based on a random forest achieved excellent precision and recall. But when deployed, merchants hated it: it blocked legitimate-looking charges, costing them apparent revenue. To them, the system felt capricious and punitive.

When the team introduced explainability—showing *why* each transaction was flagged (e.g., "this card has been used from five countries today")—merchant satisfaction transformed. The same model, the same outcomes, but now with visible reasoning. Trust emerged not from different results, but from different comprehension.

## Forces

- **Metric myopia:** Models optimize for statistical measures; users judge by subjective impact.
- **Legibility gap:** Technical correctness doesn't translate to perceived fairness or clarity.
- **Responsibility gradient:** Developers own accuracy; PMs own experience; users own risk.
- **Transparency paradox:** Full technical detail overwhelms; no explanation alienates.
- **Trust elasticity:** Users tolerate error if they understand why decisions occur.

## Navigation Strategies

Design for interpretability, not just performance. Treat explanation, visibility, and feedback as core product features rather than optional add-ons.

- Include product and design perspectives in defining model success metrics.
- Map every automated decision to a user-facing explanation layer.
- Test for perceived fairness and clarity alongside statistical performance.
- Treat explainability as UX, not compliance.
- Recognize that rational transparency (enough to restore agency) outperforms full disclosure (too much to parse).

## Consequences

- Alignment improves between system behavior and user understanding.
- Trust grows not from perfection, but from predictability and perceived integrity.
- Technical success becomes communicable and defensible.
- If neglected, systems erode user confidence even when they are objectively right.

## Systems Note

The Algorithm–Product Gap mirrors the broader distinction between system optimization and human alignment. In socio-technical systems, success requires coherence across both layers: the algorithm must serve the narrative of user agency.

Bridging the gap often means translating between probabilistic correctness and experiential truth—a form of product craftsmanship that transforms abstract intelligence into felt reliability.

## Known Uses

- Fraud detection, content moderation, credit scoring, and other opaque risk systems.
- Recommendation engines that optimize for engagement while degrading satisfaction.
- Explainable AI dashboards translating model reasoning into product context.

## Related Patterns

- [[Explanatory Power vs Precision]] — communication tradeoffs in translating complexity.
- [[Cultural Dialects]] — subgroups interpret system decisions through different trust lenses.
- [[Dual Competence]] — balancing technical and experiential definitions of correctness.
