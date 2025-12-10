[//]: # (bc-madr v0.1)
<!-- modified MADR 4.0.0 -->

# Choose a database library

* status: proposed
* date: 2025-10-29
* decision-makers: Hannah MacDonald

## Context and Problem Statement

We need a NodeJS library to interface with our database. Ideally, this library will be cohesive with our current setup including TypeScript and NestJS.

## Decision Drivers

* Ease of use
* Well supported / maintained
* Works with TypeScript / NestJS

## Considered Options

* pg
* Knex
* Sequelize
* MikroORM
* TypeORM

## Decision Outcome

Chosen option: "TypeORM", because it blends best with our current TypeScript and NestJS setup while also being widely supported and actively maintained.

### Consequences

* Will require models for DB tables, which is a bit more addtional work than a query builder or raw querying.

## Pros and Cons of the Options

### pg

https://node-postgres.com/ | [GitHub](https://github.com/brianc/node-postgres)

> Non-blocking PostgreSQL client for Node.js. Pure JavaScript and optional native libpq bindings.

* Good, because it is easy to set up and flexible
* Good, because it is very widely used and well maintained (it is the underlying PostgreSQL driver for virtually every other library)
* Bad, because it is barebones and has little additional features you would normally expect fora database library
* Bad, because it has no native TypeScript support

### Knex

https://knexjs.org/ | [GitHub](https://github.com/knex/knex)

> Knex.js (pronounced /kəˈnɛks/) is a "batteries included" SQL query builder for PostgreSQL, CockroachDB, MSSQL, MySQL, MariaDB, SQLite3, Better-SQLite3, Oracle, and Amazon Redshift designed to be flexible, portable, and fun to use.

* Good, because it is easy to set up and flexible
* Good, because it is widely used
* Good, beacuse it is a query builder and provides methods for the most common queries rather than having to write raw SQL statements
* Bad, because it lacks inherent TypeScript support
* Bad, because it doesn't really follow the design patterns of NestJS and code appears incohesive

### Sequelize

https://sequelize.org/ | [GitHub](https://github.com/sequelize/sequelize)

> Sequelize is an easy-to-use and promise-based Node.js ORM tool for Postgres, MySQL, MariaDB, SQLite, DB2, Microsoft SQL Server, Snowflake, Oracle DB and Db2 for IBM i. It features solid transaction support, relations, eager and lazy loading, read replication and more.

* Good, because it has widespread use
* Good, because it is actively maintained
* Neutral, because it is an ORM and requires full models for each table and therefore more setup
* Bad, because TypeScript support is an active work in progress and is therefore only partially supported

### MikroORM

https://mikro-orm.io/ | [GitHub](https://github.com/mikro-orm/mikro-orm)

> TypeScript ORM for Node.js based on Data Mapper, Unit of Work and Identity Map patterns. 

* Good, because it has its own package for NestJS
* Good, because it natively supports TypeScript
* Neutral, because it is an ORM and requires full models for each table and therefore more setup
* Bad, because it only has one main maintainer, making its future stability questionable

### TypeORM

https://typeorm.io/ | [GitHub](https://github.com/typeorm/typeorm)

> TypeORM is an ORM that can run in Node.js, Browser, Cordova, Ionic, React Native, NativeScript, Expo, and Electron platforms and can be used with TypeScript and JavaScript (ES2021). Its goal is to always support the latest JavaScript features and provide additional features that help you to develop any kind of application that uses databases - from small applications with a few tables to large-scale enterprise applications with multiple databases.

* Good, because it has widespread use
* Good, because it is actively maintained
* Good, because it is designed for TypeScript
* Good, because its heavy TypeScript decorator use is cohesive with NestJS design patterns
* Neutral, because it is an ORM and requires full models for each table and therefore more setup
