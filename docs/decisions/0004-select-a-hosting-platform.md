[//]: # (bc-madr v0.1)
<!-- modified MADR 4.0.0 -->

# Select a cloud hosting platform

* status: accepted
* date: 2025-09-16
* decision-makers: Todd Scharien, Hannah MacDonald

## Context and Problem Statement

We need a place to host and run the retry mechanism.

## Considered Options

* OpenShift
* No other options were considered

## Decision Outcome

Chosen option: "OpenShift", because no other options were considered.

### Consequences

* Good, because OpenShift is provided as a free private cloud service to BC Gov at large
* Good, because there is a growing internal community to draw support from
* Good, because of Kubernetes' reliability
* Good, because we can use Helm for Infrastructure as Code
* Good, because we can set up CI/CD for rapid development and easier deployments
* Bad, because OpenShift can be difficult to learn, making developer onboarding require more effort

### Confirmation

Work with members of ARB to review Helm charts and confirm the architecture is set up correctly.
