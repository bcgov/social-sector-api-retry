[//]: # (bc-madr v0.1)
<!-- modified MADR 4.0.0 -->

# Chhose a database solution

* status: proposed
* date: 2025-09-16
* decision-makers: Todd Scharien, Hannah MacDonald

## Context and Problem Statement

We need a database to hold information about the requests to be sent while we wait to retry. These requests can differ in type (GET, POST, etc.), format (multipart form, JSON, etc), endpoint and content, so we need a flexible way of storing all of the required information about a request

## Decision Drivers

* Maintainability
* Easier to onboard new developers
* Flexible schema, able to accommodate different types and sources of requests
* Persitent storage, accesible even if the application is stopped or restarted

## Considered Options

* In-memory cache
* MongoDB
* PostgreSQL

## Decision Outcome

Chosen option: "PostgreSQL", because it allows for the best balance of flexibility and defined structure needed to accomodate varying requests

### Consequences

* Will require a DB setup in OpenShift, and possibly a database backup service

## Pros and Cons of the Options

### In-memory cache
* Good, because it is easy to set up and flexible
* Bad, because it does not offer persistent storage
* Bad, because data expires after a certain amount of time rather than being removed as needed.

### MongoDB
* Good, because it uses a JSON-like structure natively, similar to how requests would be sent
* Good, because the schema is inherently flexible
* Good, because it inherently supports high availabilty and load balancing
* Good, because it has persistent storage
* Bad, because unstructed data can be more complex to access
* Bad, because it has some complicated licensing issues for commerical use when self-hosted

### PostgreSQL
* Good, because it supports JSON as a datatype, and it can be queried / indexed
* Good, because it is simple to set up and maintain
* Good, because it uses SQL, which is widely known among developers
* Good, because it has high avalibilty options if needed (Crunchy, Patroni...)
* Good, because it has persistent storage
* Good, because it is free and open-source
* Bad, because it requires a structured schema for tables, making it slightly more complicated to generalize
