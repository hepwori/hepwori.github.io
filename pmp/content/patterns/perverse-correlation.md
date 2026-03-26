---
title: Perverse Correlation
also_known_as: Metric Inversion, Proxy Reversal
category: systems-and-incentives
summary: When a metric becomes a target and its meaning inverts.
---

## Context

Organizations rely on metrics to represent success. Because real outcomes are complex, teams use proxies—measurable quantities correlated with desired results—to track progress. Over time, these proxies can become goals in themselves, especially when they are easy to measure or communicate.

The result is a pattern where the relationship between metric movement and actual value creation flips: improving the metric begins to imply *worse* real outcomes.

## Problem

When a metric becomes a target, its meaning changes. A proxy that once indicated health now rewards activity that undermines the underlying goal.

Teams continue to optimize locally—doing what appears rational from their position—while global outcomes degrade. The organization confuses movement with improvement.

## Examples

**Mobile Search:** Early Google mobile search teams tracked queries per day as a success metric. As search quality improved, users found answers faster and issued fewer queries. Paradoxically, improving the experience made the metric look worse.

**Comments in Google Docs:** The *comments created per day* metric rewarded the creation of discussion volume rather than collaboration quality. Teams celebrated growth in comment activity even if it reflected confusion or friction.

**Documentation Traffic:** A major tech company used unique users and pageviews as north-star metrics for its online documentation site. Yet, the healthier the products became, the less documentation users needed. Product improvements made the metrics decline.

## Forces

- **Proxy simplicity:** Metrics that are easy to measure are chosen over those that are meaningful but ambiguous.
- **Local optimization:** Each team rationally optimizes the numbers they own, even when those numbers diverge from user value.
- **Correlation decay:** The relationship between proxy and outcome erodes over time as systems adapt.
- **Organizational legibility:** Metrics that communicate cleanly to leadership are privileged over nuanced indicators.
- **Reward asymmetry:** Teams are rewarded for metric improvement, not for noticing when the metric's meaning has inverted.

## Navigation Strategies

Treat every metric as a hypothesis about value, not as a truth. Revisit its relationship to real outcomes regularly—especially when incentives or user behavior change. Ask not only *is the number moving?* but *is its meaning still aligned with value?*

- Periodically test whether metric movement continues to correlate with the desired outcome.
- Maintain a small number of **interpretive metrics**—qualitative signals that keep teams anchored in user reality.
- Reward teams for detecting and correcting metric inversions.
- When possible, measure the *absence of friction* rather than the volume of activity.

## Consequences

- Dashboards show progress while outcomes stagnate or regress.
- Teams celebrate success while destroying value.
- Leadership loses the ability to distinguish genuine improvement from metric theater.
- Over time, cynicism grows as practitioners sense the divergence between measurement and meaning.

## Known Uses

- Engagement metrics in social media platforms where increased usage correlates with lower well-being.
- Productivity metrics in support organizations where faster ticket closure correlates with poorer customer satisfaction.
- Developer velocity measures that reward output quantity over maintainability or impact.

## Related Patterns

- [[Dual Competence]] — balancing craft skill and organizational fluency, including the politics of metric selection.
- [[Reward Loop Asymmetry]] — short-term reward for measurable outcomes vs. long-term value creation.
- [[Ontology Leakage]] — when internal abstractions, such as metrics, replace user-centered reality.
