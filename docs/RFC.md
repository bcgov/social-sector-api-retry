# ICM Submission Queue

Author(s): Todd Scharien, Sagar Shah

Business area: MCFD Mobility project team

Proposed: 2025-12-02

## Abstract

This document is an overview of an API-based submission queue for ICM to be used when ICM is unavailable—either during maintenance, outages, or other reasons.

## Intro

When ICM is unavailable, Provincial Centralized Screening (PCS) teams will continue to receive reports and must rely on manual reporting and data entry. This creates a backlog of repetitive and tedious work that should be completed before accepting new reports. Otherwise, these reports *could* be entered later when time allows—but delaying entry could invite other issues, particularly in a fast paced environment: mis-triaging, loss of reports, incorrect data entry, duplicate entry, to name a few.

To resolve this, an ICM Submission Queue can hold onto any number of submissions from various downstream clients (webform submissions, Salesforce requests, etc.) for a given upstream channel (e.g. Create Memo). Staff can submit to this queue app, return to their normal duties, and be updated via email of their submissions' status. The queue app will watch upstream ICM status, wait until ICM is available again, and then forward all cached submissions onward to ICM on behalf of the users.

## ADR overview

To allow workers to submit forms while ICM is unavailable, we will use a [NestJS server app (0003)](https://github.com/bcgov/social-sector-api-retry/blob/dev/docs/decisions/0003-choose-an-api-framework.md) hosted in [BC Gov's private cloud (0004)](https://github.com/bcgov/social-sector-api-retry/blob/dev/docs/decisions/0004-select-a-hosting-platform.md).

To make sure this stop-gap solution is reliable, the server app needs to maintain its own [storage (0006)](https://github.com/bcgov/social-sector-api-retry/blob/dev/docs/decisions/0006-choose-a-database-solution.md) and [inbound/outbound queues (0008)](https://github.com/bcgov/social-sector-api-retry/blob/dev/docs/decisions/0008-choose-a-queuing-library.md).

Note that the chosen queueing library uses Redis 8.+ (on the AGPLv3 licence) which can persist to disk. We chose to [also keep a database (0009)](https://github.com/bcgov/social-sector-api-retry/blob/dev/docs/decisions/0009-use-both-a-database-and-cache-solution.md) for two reasons:

1. Redis is designed for kilobyte-sized payloads and we expect the submissions we receive could be up to 5MB.

1. Redis is designed for reconstructible data—the submissions we receive cannot be regenerated. A proper source-of-truth copy should be maintained until processing is successful.