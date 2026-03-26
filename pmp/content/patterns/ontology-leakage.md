---
title: Ontology Leakage
also_known_as: Internal Model Projection
category: product-and-user
summary: When a company's internal model of the world is exposed to users.
---

## Context

Product managers and teams often inherit the internal data models, structures, and categories of their organization. These internal systems—account hierarchies, billing schemas, technical identifiers, business units, KPIs—shape how the company perceives the world. Over time, these models start to feel like reality itself.

When unexamined, they leak directly into the user experience.

## Problem

Internal constructs are treated as natural truths rather than organizational artifacts. Teams build interfaces, workflows, and experiences that mirror the company's internal ontology instead of the user's mental model.

The result is a product that forces users to navigate the company's internal complexity—an experience designed to make *the system's world* legible, not *the user's world*.

## Forces

- **Cognitive capture:** Teams internalize the organization's categories and stop questioning their validity.
- **Structural convenience:** It's easier to expose existing fields and IDs than to abstract or reframe them.
- **Alignment pressure:** Internal stakeholders want to see their systems represented in the product.
- **Illusion of rigor:** Mirroring back system detail feels precise and thorough, even when it confuses users.
- **Reward asymmetry:** Fixing ontology leakage requires deep rethinking but yields little visible short-term reward.

## Examples

- A portal that asks customers to select their business unit from a dropdown—reflecting company structure, not customer reality.
- An app that requires users to know their account number instead of authenticating through a user-friendly identifier.
- A dashboard exposing internal states ("ERP posting status: false") that have no user relevance.

**Macro Example: Amazon Alexa.** Amazon's voice assistant embodied ontology leakage at organizational scale. The initiative began from internal strategic anxieties ("We need a presence in the home"; "Voice is an emerging interface we must own") rather than pressing user problems. Alexa's ontology mirrored Amazon's worldview—a retail catalog accessible by voice, a constant brand presence, a data-gathering channel.

Users, meanwhile, never experienced an acute need for most of what Alexa solved. The result was a technically remarkable system that created vast internal value (strategic coverage, data, ecosystem lock-in) but little sustained user value. At root, Amazon failed to distinguish a business problem from a customer problem — and built accordingly.

## Navigation Strategies

Re-examine every assumed entity, category, and relationship through a user lens:

- Ask: *Would this concept exist if the organization didn't?*
- Challenge inherited vocabulary—does the language make sense to the user or only to us?
- Treat internal ontologies as implementation details, not interface primitives.
- Design for the user's world, then map it onto the system's world under the hood.

Healthy products perform **ontological translation**: they mediate between the company's internal structures and the user's mental model, hiding seams rather than exposing them.

## Consequences

- Users experience friction, confusion, or distrust when they must understand the company's internal workings to get value.
- Teams mistake internal coherence for external clarity.
- Organizations lose touch with customer perspective as their ontology hardens into dogma.
- In the extreme, entire product strategies can evolve to serve organizational needs more than user needs (see: Alexa).

## Known Uses

- Enterprise SaaS platforms exposing internal IDs and hierarchies in customer workflows.
- Financial systems built around legacy account structures requiring users to manually reconcile identifiers.
- Government digital services that replicate bureaucratic form fields instead of reimagining the process for the citizen.

## Related Patterns

- [[Cultural Dialects]] — how subcultural language divergence fuels strategic drift.
- [[Dual Competence]] — navigating the trade-off between organizational fluency and craft.
- [[Explanatory Power vs Precision]] — tuning communication to audience cognitive resolution.
