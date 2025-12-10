[//]: # (bc-madr v0.1)
<!-- modified MADR 4.0.0 -->

# Choose a queuing library

* status: proposed
* date: 2025-12-10
* decision-makers: Hannah MacDonald

## Context and Problem Statement

Rather than implement an entirely new queueing system, we want a NodeJS library to handle the intricacies of queuing and job scheduling. Ideally, this library will be cohesive with our current setup including TypeScript and NestJS.

## Decision Drivers

* Ease of use
* Well supported / maintained
* Works with TypeScript / NestJS

## Considered Options

* Bull
* BullMQ

## Decision Outcome

Chosen option: "BullMQ", because it blends best with our current TypeScript and NestJS setup while also being actively maintained.

### Consequences

* Will require Redis, which is an additional piece to implement.

## Pros and Cons of the Options

### Bull

https://optimalbits.github.io/bull/ | [GitHub](https://github.com/OptimalBits/bull)

> Premium Queue package for handling distributed jobs and messages in NodeJS.

* Good, because it is easy to set up and flexible
* Good, because there is a NestJS package supporting it
* Neutral, because it requires an external cache solution like Redis, which is another component we'd need to implement
* Bad, because it is currently in maintenance mode 
* Bad, because it has no native TypeScript support

### BullMQ

https://bullmq.io/| [GitHub](https://github.com/taskforcesh/bullmq)

> BullMQ is a fast and robust background job processing library for Redis

* Good, because it is easy to set up and flexible
* Good, because there is a NestJS package supporting it
* Good, because it has native TypeScript support
* Good, because it is actively being maintained
* Neutral, because it requires an external cache solution like Redis, which is another component we'd need to implement


