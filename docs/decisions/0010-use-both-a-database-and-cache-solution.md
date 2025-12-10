[//]: # (bc-madr v0.1)
<!-- modified MADR 4.0.0 -->

# Use both a database and cache solution

* status: proposed
* date: 2025-12-10
* decision-makers: Hannah MacDonald

## Context and Problem Statement

With both PostgreSQL and Redis offering persistent storage, the question arises whether or not both are required for our use case. Redis is required for the queuing library, so we need to consider whether we still need PostgreSQL or not.

## Decision Drivers

* Data consistency
* Able to handle larger requests (~5mb data)

## Considered Options

* Remove PostgreSQL and only use Redis
* Use both Redis and PostgreSQL

## Decision Outcome

Chosen option: "Use both Redis and PostgreSQL", because it allows us to store larger files more efficently and effictively separates the concerns the the two systems: PostgreSQL for data, and Redis for job information

### Consequences

* Added complexity with 2 external systems to deal with instead of 1
* May need to slightly alter database tables to not include status, as that is now part of the job info instead.

## Pros and Cons of the Options

### Remove PostgreSQL and only use Redis

* Good, because it is less complex and less external systems to deal with
* Bad, because Redis is not designed to store large individual records, and we may have large (~5mb) incoming requests
* Bad, because it allows for less separation of concerns: Redis tracks both incoming data and job status simultaneously.
* Bad, because Redis is a cache, inherently designed for reconstructible data. The submissions we receive cannot be regenerated. A proper source-of-truth copy should be maintained until processing is successful.

### Use both Redis and PostgreSQL

* Good, because it plays to the strengths of both Redis and PostgreSQL: Redis is used for caching job data, while PostgreSQL can store larger files to use as needed, with more consistency guarantees.
* Good, because it allows for more separtion of concerns.
* Bad, because it adds more system complexity.


