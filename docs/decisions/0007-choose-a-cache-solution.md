[//]: # (bc-madr v0.1)
<!-- modified MADR 4.0.0 -->

# Choose a cache solution

* status: proposed
* date: 2025-12-09
* decision-makers: Hannah MacDonald

## Context and Problem Statement

BullMQ requires an external cache to run. We need to choose a cache solution to work with it.

## Decision Drivers

* Ease of use
* Well supported / maintained
* Open source licensing options
* Data consistency guarantees (accuracy over speed) to ensure that duplicate jobs are not executed
* Persistent storage option in the event of cache Pod failure
* Compatible with BullMQ

## Considered Options

* Redis
* Redis Cluster
* Dragonfly
* KeyDB

## Decision Outcome

Chosen option: "Redis", because it has the best data consistency guarantees in its non-HA options. Due to the fact that BullMQ does not use transactions in its standard library functions, the single threading also helps ensure consistency, which the other cache options do not have. Speed is not our main concern, so the drawbacks of the multithreaded options outweigh the benefits for us.

### Consequences
* Redis has some licensing issues with open source licenses. Versions prior to 8, but after 7.2, do not have an open source licensing option. Versions 8 and above have a "tri-license", allowing you to pick between AGPLv3 (the open source option), RSALv2 and SSPLv1. Versions 7.2 and below fall under the open source license BSD-3-Clause. Since we are not making edits to Redis itself, the differences between the 2 open source license options are irrelevant to us (AGPLv3 requires distributing any modified versions of the software while BSD-3 does not), but it does mean that we must choose a version 8 or above, or 7.2 and below.
* For security reasons, we want to use the most recent version of Redis still receiving support, so we will be going with 8.2.x. BullMQ is compatible with versions 6.2.x and above, so this should work, but we have to be careful when testing to ensure this is true.
* Redis has a persistent storage option to preserve the queue even when the pod serving it goes down. It can also allow us to use multiple workers at a time, allowing us to scale our instances of NestJS as needed while maintaing one central queue. We have to use append only file (AOF) mode for this to mantain data consistency, however.

## Pros and Cons of the Options

### Redis

https://redis.io/ | [GitHub](https://github.com/redis/redis)

> For developers, who are building real-time data-driven applications, Redis is the preferred, fastest, and most feature-rich cache, data structure server, and document and vector query engine. 

* Good, because it is easy to set up and flexible.
* Good, because it is actively maintained.
* Good, because it has open source licensing options in the most recent versions (more on this in the consequences section).
* Good, because it offers persistence with an append only file (AOF) option for data consistency.
* Good, because BullMQ was designed with base Redis in mind.
* Neutral, because it is slower than multithreaded options.

### Redis Cluster

https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/| [GitHub](https://github.com/redis/redis)

> Redis Cluster provides a way to run a Redis installation where data is automatically sharded across multiple Redis nodes.

* Good, because it is actively maintained.
* Good, because it has open source licensing options in the most recent versions (more on this in the consequences section).
* Good, because it offers persistence with an append only file (AOF) option for data consistency.
* Neutral, because it requires a more complicated setup for BullMQ to run correctly because of cluster mode differences.
* Neutral, because it is HA. Given that this is a backup system by design, HA is not our main concern.
* Neutral, because it is slower than multithreaded options.
* Bad, because cluster consistency requires [specific Redis commands](https://redis.io/docs/latest/operate/rs/databases/durability-ha/consistency/) that are not used by default by BullMQ.

### Dragonfly

https://www.dragonflydb.io/| [GitHub](https://github.com/dragonflydb/dragonfly)

> Dragonfly is a lightning fast, in-memory data store built for heavy workloads running on modern cloud hardware. Dragonfly is 100% API compatible with Redis, Valkey, and Memcached, allowing for quick and seamless migrations that result in up to 25X better performance on half the infrastructure.

* Good, because it is easy to set up and flexible.
* Good, because it is actively maintained.
* Good, because it is open source.
* Neutral, because it provides more speed than Redis. This is nice to have, but not our main decision driver.
* Neutral, because it provides HA options. Given that this is a backup system by design, HA is not our main concern.
* Bad, because it is multithreaded. While this would normally be desirable, BullMQ does not use transactions in most of its methods.
As such, this can potentially sacrifice accuracy. In an edge case, 2 workers could pick up the same job, and execute a POST request twice, which we don't want.
* Bad, because it offers persistence, but without an append only file (AOF) option. This reduces data consistency.
* Bad, because while it can be used with BullMQ, it requires specific setup, and [priorities and rate limiting do not function across multiple queues](https://docs.bullmq.io/guide/redis-tm-compatibility/dragonfly), which we need.

### KeyDB

https://docs.keydb.dev/| [GitHub](https://github.com/Snapchat/KeyDB)

> KeyDB is a fully open source database, backed by Snap, and a faster drop in alternative to Redis

* Good, because it is easy to set up and flexible.
* Good, because it is open source.
* Good, because it offers persistence with an append only file (AOF) option for data consistency.
* Neutral, because it provides more speed than Redis. This is nice to have, but not our main decision driver.
* Neutral, because it provides HA options. Given that this is a backup system by design, HA is not our main concern.
* Bad, because it is multithreaded. While this would normally be desirable, BullMQ does not use transactions in most of its methods.
As such, this can potentially sacrifice accuracy. In an edge case, 2 workers could pick up the same job, and execute a POST request twice, which we don't want.
* Bad, because it isn't explicitly supported by BullMQ. Given that Dragonfly, another similar Redis alternative, needs specific setup
to work with BullMQ, it is likely we will run into issues with how to integrate this.


