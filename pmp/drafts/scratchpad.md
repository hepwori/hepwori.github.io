# Pattern Drafts Scratchpad

Holding area for candidate patterns that aren't ready for `content/patterns/` yet.
Move to a dedicated draft file once a pattern has a name and rough section structure.

---

## Candidate: The Integration Preservation Insight

**Status:** Early — no name yet, navigation strategies not developed

**Source stories:**

1. **Twitter / Gnip acquisition.** Isaac joined Twitter at ~100 people; by the time of the MoPub acquisition Twitter was ~3,500 and had lost its original operating velocity. Isaac moved to Boulder as a "first-lander" to integrate the acquisition. On his first Monday he observed a 2-hour weekly leadership meeting (CEO, COO, head of sales, head of product, head of engineering, field leads, financial controller) where nothing was blocked — every decision could be made synchronously because everything needed was in the room. The velocity was astonishing by contrast to Twitter. Isaac's realization: his job was to *preserve* this as long as possible, not to integrate it away.

2. **Google / Apigee acquisition.** Isaac transferred into the Apigee team as a Google "lander." Because of the Twitter/MoPub experience he was more attuned to *what the asset was* — not just the product or technology, but the operating model — and actively worked to protect it from organizational antibodies.

**Core insight:** The dominant frame for acquisitions is "integrate fast" — align tools, processes, reporting, culture. But the thing that made the acquired company valuable is often precisely what integration destroys. The lander's job, correctly understood, is preservation not assimilation. The acquirer's organizational antibodies are often the greatest threat to the acquired asset.

**What still needs developing:**
- A name (something around "acquisition preservation", "organizational antibodies", "asset misidentification"?)
- Navigation strategies: what did Isaac actually *do* differently at Apigee? This is where the actionable insight lives.
- Whether the *decision closure* observation (see below) is a context/force within this pattern or stands alone

**Related patterns (likely):** Dual Competence, Fluency Capture, Conservation of Organizational Cost

---

## Candidate: Decision Closure

**Status:** Uncertain — may be a context/force within the integration pattern rather than a standalone pattern

**Observation:** A small, co-located, cross-functional leadership team can exhibit *decision closure* — every decision can be made without leaving the room, because all required authority, context, and judgment is present synchronously. This produces extraordinary velocity. It erodes naturally as organizations scale: functions specialize, authority distributes, and decisions accumulate external dependencies.

**Concern:** "Small teams decide faster" is well-trodden ground. The novel element may be the *recognition* of this quality as something precious and preservable — which folds back into the integration pattern above.

**Open question:** Is there a standalone pattern here about how to *maintain* decision closure as an organization grows (before an acquisition is involved)? Or is it just a named observation that serves as context for other patterns?

---

## Candidate: Phase Transition Debt

**Status:** Early — name settled, core insight clear, navigation strategies undeveloped

**Source story:**

**Stripe / Slack as knowledge system (~2015).** At ~200 people, Stripe ran almost entirely on Slack for knowledge management — "how do I find out X" was answered by "drop into channel Y and ask." Corporate knowledge lived in heads; Slack provided random-access retrieval via channel structure (not fully fluid, not top-down — a semi-rigid emergent ontology). This worked well for a small, very-online, high-context team even through continuous knowledge churn. But by ~300 people it started feeling broken: cross-timezone gaps, no sediment, no accumulation. By ~500, lawyers mandated a retention policy and old-timers faced the horror of institutional knowledge dropping beyond recovery. By the time the problem was visible, significant unrecoverable debt had accumulated.

**Core insight:** Some organizational costs scale continuously but their consequences manifest discontinuously. The system appears healthy — locally functional, individually rational at every step — until a threshold is crossed, after which accumulated debt becomes visible all at once and is often partially or wholly unrecoverable. Unlike technical debt, which is theoretically payable, phase transition debt can expire: once the Slack history is deleted, that knowledge is simply gone.

The system gives no warning signal because every individual interaction still resolves successfully. There is no leading indicator that distinguishes "this is working" from "this is working AND we are three months from catastrophic knowledge loss."

**Related pattern:** Reorgs that are six months too late exhibit the same structure — informal networks co-evolve with formal structure and become load-bearing; the reorg destroys the informal network without transferring its value; the cost doesn't disappear (conservation of organizational cost) but crystallizes as rebuild overhead plus transitional dysfunction, paid simultaneously. Hysteresis applies: you can't reorg back to the previous state.

**Catastrophe theory framing:** The control parameter (headcount, time since last reorg) changes continuously. The state variable (knowledge accessibility, org coherence) tracks smoothly until a cusp, then snaps. Hysteresis means the snap point going forward differs from the recovery point going back — you can't simply reverse the control parameter to restore prior state.

**Relationship to Conservation of Organizational Cost:** Phase transition debt is a specific failure mode within conservation — the deferred cost doesn't just displace, it *crystallizes* at a threshold event (retention policy, reorg) into a form that is partially unrecoverable. The "loophole" (no documentation overhead! just ask slack!) was always a deferral, never an elimination.

**What still needs developing:**
- Navigation strategies: what are the leading indicators? is instrumentation even possible before the cusp?
- Whether "crystallization point" is a better name (implies irreversibility more clearly)
- The distinction between recoverable and unrecoverable crystallization events

**Related patterns:** Conservation of Organizational Cost, Alignment Mirage, Representational Parallax (candidate below)

---

## Candidate: Representational Parallax

**Status:** Early — name and core insight settled, examples need development

**Source insight:** Emerged from discussion of Block's "world model" org architecture and dead reckoning as an analogy for world model failure modes.

**Core insight:** Every organization maintains (at least) two representations of itself simultaneously: an explicit/formal layer (org chart, ERP, documented processes, the world model's latent representation) and an implicit/emergent layer (informal networks, tacit knowledge in heads, actual causal structure, the true eigenvectors of org behavior). These co-evolve but at different rates and via different update mechanisms. The explicit layer is legible and manipulable; the implicit layer is load-bearing but opaque. Interventions on the explicit layer have unpredictable effects on the implicit layer because the dependency runs the opposite direction from what's assumed.

The gap between the two representations — representational parallax — widens continuously and is only visible when you triangulate from multiple vantage points. The organization's explicit self-model drifts from its operational reality without either layer flagging the divergence.

**Dead reckoning analogy:** Dead reckoning integrates velocity + heading over time to estimate position — works over short intervals, degrades catastrophically over long ones as errors compound. The world model equivalent: distributional shift (world changes, model goes stale), latent drift (signal meanings shift without label changes), selection bias (recorded artifacts are incentive-shaped, not neutral), and confidence without accuracy (point estimates delivered with full conviction, no widening uncertainty cone). The fix in navigation: periodic GPS fixes against ground truth. The organizational equivalent requires deliberate instrumentation that doesn't emerge naturally.

**Instances:**
- Block's corporate world model: explicit (latent AI representation) vs implicit (actual org state); registration requires ongoing epistemic work that isn't in the org chart
- Late reorgs: explicit (org chart) vs implicit (informal network); reorg changes formal structure, informal network has its own inertia and becomes misaligned
- Stripe/Slack: explicit (channel structure) vs implicit (knowledge in heads); retention policy destroys implicit layer without the explicit layer absorbing it

**Relationship to Ontology Leakage:** Ontology leakage is the failure mode when the explicit layer bleeds into user-facing design. Representational parallax is the failure mode when the explicit layer drifts from the implicit layer internally. Companion patterns rather than the same pattern. There's also an inverse: a learned representation that *resists* human ontology (e.g. ML latent spaces whose basis vectors don't correspond to human-legible concepts) — this is powerful but creates its own legibility/governance problems.

**What still needs developing:**
- Navigation strategies: how do you instrument for parallax? what are the registration mechanisms?
- More grounded examples beyond the theoretical
- Whether "parallax" is the right metaphor (implies the gap is viewpoint-dependent, which is actually accurate but may be too subtle)

**Related patterns:** Conservation of Organizational Cost, Alignment Mirage, Ontology Leakage, Phase Transition Debt (candidate above)

---

## Candidate: Cost Crystallization

**Status:** Very early — may be a force/consequence within Phase Transition Debt rather than standalone

**Observation:** Within conservation of organizational cost, there is a specific and more severe failure mode: deferred invisible cost that doesn't merely displace but becomes irreversible at a threshold event. Regular cost displacement is theoretically recoverable (pay the debt down later). Crystallization is not — the Slack history is gone, the informal network is destroyed, the institutional knowledge has left with the people.

**Open question:** Is this a standalone pattern or a named force within Phase Transition Debt? The distinction may be whether crystallization can occur *without* a phase transition (i.e., gradual irreversible accumulation rather than a snap). If yes, standalone. If it always co-occurs with a threshold event, it's a force.

**Related patterns:** Conservation of Organizational Cost, Phase Transition Debt
