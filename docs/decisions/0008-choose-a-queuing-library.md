[//]: # (bc-madr v0.1)
<!-- modified MADR 4.0.0 -->

# Choose a queuing library

* status: proposed
* date: 2025-11-27
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
* Redis has some licensing issues with open source licenses. Versions prior to 8, but after 7.2, do not have an open source licensing option. Versions 8 and above have a "tri-license", allowing you to pick between AGPLv3 (the open source option), RSALv2 and SSPLv1. Versions 7.2 and below fall under the open source license BSD-3-Clause. Since we are not making edits to Redis itself, the differences between the 2 open source license options are irrelevant to us (AGPLv3 requires distributing any modified versions of the software while BSD-3 does not), but it does mean that we must choose a version 8 or above, or 7.2 and below.
* For security reasons, we want to use the most recent version of Redis still receiving support, so we will be going with 8.2.x. BullMQ is compatible with versions 6.2.x and above, so this should work, but we have to be careful when testing to ensure this is true.
* Redis has a persistent storage option to preserve the queue even when the pod serving it goes down. It can also allow us to use multiple workers at a time, alowwing us to scale our instances of NestJS as needed while maintaing one central queue. We have to use append only file (AOF) mode for this to mantain data consistency, however.
* Redis itself has HA options, but these don't guarantee data consistency, making a single instance solution our best option.
* There is an alternative option to Redis, [Dragonfly](https://github.com/dragonflydb/dragonfly), which avoids the open source issues entirely. However, it is not single threaded like Redis, which can potentially pose issues as we generally don't use transactions with BullMQ. As such, we do need Redis.

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


