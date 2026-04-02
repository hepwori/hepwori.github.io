# PMP Project Handoff — April 2026

## What this is

Isaac is building *A Pattern Language for Product Management* — a collection of 
recurring organizational and PM patterns documented in GoF format (context, 
problem, forces, examples, navigation strategies, consequences, related patterns). 
Live at https://hepwori.github.io/pmp/. Source at 
https://github.com/hepwori/hepwori.github.io/tree/main/pmp/content/patterns.

Existing published patterns (15): algorithm-product-gap, alignment-mirage, 
conservation-of-organizational-cost, creating-gravity, cultural-dialects, 
dual-competence, elastic-leadership, explanatory-power-vs-precision, 
fluency-capture, ontology-leakage, perverse-correlation, reward-loop-asymmetry, 
surface-consensus, symbolic-friction, vision-anchoring.

Scratchpad for drafts at:
https://raw.githubusercontent.com/hepwori/hepwori.github.io/refs/heads/main/pmp/drafts/scratchpad.md
(already contains: integration preservation, decision closure, and the three 
candidates below)

Introduction at:
https://raw.githubusercontent.com/hepwori/hepwori.github.io/refs/heads/main/pmp/content/introduction.md

---

## What emerged in this conversation

### Three candidate patterns (priority order)

**1. Phase Transition Debt** (next to polish)

Some organizational costs scale continuously but manifest discontinuously. The 
system appears locally functional at every step — no individual warning signal — 
until a threshold is crossed, after which accumulated debt becomes visible all 
at once and is often partially or wholly unrecoverable.

Key features distinguishing it from plain technical debt:
- no leading indicator (every individual interaction still resolves)
- hysteresis: you can't reverse the control parameter to restore prior state
- crystallization: some threshold events (retention policy, reorg) convert 
  deferred cost into permanent loss, not just visible cost

Source story: Stripe ~2015, 200→500 people. Slack as knowledge system — 
corporate knowledge in heads, Slack as random-access retrieval layer. Worked 
well at small scale; invisibly fragile as scale grew; lawyers mandated retention 
policy and institutional knowledge became unrecoverable. By the time the problem 
was visible, the debt had expired.

Catastrophe theory framing is precise: headcount is the control parameter, 
knowledge accessibility is the state variable, the cusp is the snap point. 
Hysteresis means you can't simply shrink back to restore prior state.

Navigation strategies still underdeveloped — honest answer may be "prophylactic 
not diagnostic": assume you're always closer to the cusp than you think; design 
for sediment continuously rather than reactively.

**2. Representational Parallax** (next after phase transition debt)

Every organization maintains two representations of itself simultaneously:
- explicit/formal layer: org chart, ERP, documented processes, world model's 
  latent representation
- implicit/emergent layer: informal networks, tacit knowledge in heads, actual 
  causal structure, true eigenvectors of org behavior

These co-evolve at different rates via different update mechanisms. The explicit 
layer is legible and manipulable; the implicit layer is load-bearing but opaque. 
The gap between them widens continuously and is only visible when triangulating 
from multiple vantage points.

Dead reckoning is the precise analogy: integrates heading+velocity over time, 
works short-term, degrades as errors compound, gives confident point estimates 
that can be precisely wrong. Failure modes map directly: distributional shift, 
latent drift, selection bias in signal, confidence without accuracy. Fix in 
navigation: periodic GPS fixes. Organizational equivalent requires deliberate 
instrumentation that doesn't emerge naturally.

Instances: Block's AI world model vs actual org state; late reorgs (org chart 
vs informal network); Stripe/Slack (channel structure vs knowledge in heads).

Needs a strong narrative example — the reorg instance is closest but lacks a 
specific story.

**3. Cost Crystallization** (may be a force within phase transition debt, not standalone)

Within conservation-of-organizational-cost, the specific failure mode where 
deferred invisible cost becomes irreversible at a threshold event. Regular cost 
displacement is theoretically recoverable; crystallization is not. Open question: 
does it always co-occur with a phase transition (in which case it's a force, not 
a pattern) or can it occur through gradual irreversible accumulation?

---

### Key conceptual relationships

The three candidates plus two existing patterns form a causal chain:

**representational parallax → phase transition debt → cost crystallization**

Parallax is the mechanism that defeats early warning: your explicit self-model 
looks fine while implicit reality degrades, so no corrective action is taken, 
debt accumulates to threshold, crystallizes. Conservation of organizational cost 
is the invariant explaining why crystallized debt doesn't disappear after the 
acute event — it converts to rebuild cost + transitional dysfunction cost paid 
simultaneously.

This means navigation for phase transition debt routes through parallax 
reduction: the prophylactic is "invest in registration mechanisms that keep 
your explicit model honest" not "watch for phase transitions."

The causal arrow is mechanistic, not correlational — relatively rare for pattern 
relationships in this collection, worth making explicit in both writeups.

---

### The eigenpattern insight

Conversation established that the pattern language doesn't need to be MECE or 
orthogonal to be useful. Named patterns are landmarks, not basis vectors. A map 
of a mountain range doesn't need to be an eigendecomposition of the terrain to 
support navigation. Recognizing a landmark orients you in the whole landscape.

Christopher Alexander knew this tension — spent 25 years after *A Pattern 
Language* (1977) searching for the deeper generative grammar in *The Nature of 
Order* (2002-2005). Identified ~15 fundamental "centers" (levels of scale, strong 
centers, boundaries, deep interlock, roughness, etc.) as the actual basis vectors 
beneath the 253 patterns. More fundamental; almost nobody uses it practically. 
The catalog remained more useful than the grammar. Lesson: the lossy projection 
is fine as long as you know it's a projection.

The collection's patterns are not orthogonal — alignment-mirage, surface-consensus, 
conservation-of-cost, phase-transition-debt, representational-parallax cluster in 
the same subspace. Probably expressible in terms of ~3 elementary patterns: 
legibility asymmetry, temporal displacement, registration failure. But those 
would be too abstract to be useful without the named instantiations.

---

### Introduction update

A paragraph addition was drafted for the end of the "Why a Pattern Language?" 
section of introduction.md, situating the project in the Alexander lineage and 
making the landmarks-not-eigenvectors philosophy explicit. Text is in the 
conversation transcript — should be retrieved and applied.

---

## Immediate next actions

1. Polish **phase transition debt** into full GoF pattern — stripe story is the 
   example, catastrophe theory framing is the intellectual backbone, navigation 
   strategies need honest development
2. Polish **representational parallax** — needs a narrative example as strong as 
   the stripe story; dead reckoning analogy is load-bearing
3. Resolve **cost crystallization** — standalone or force within phase transition 
   debt?
4. Apply introduction paragraph addition
5. Update related-patterns links across alignment-mirage, conservation-of-cost, 
   ontology-leakage to reference the new candidates once published