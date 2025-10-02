[//]: # (bc-madr v0.1)
<!-- modified MADR 4.0.0 -->

# Use a dedicated repository for project code

* status: accepted
* date: 2025-09-16
* decision-makers: Hannah MacDonald, Todd Scharien

## Context and Problem Statement

The overall solution this project belongs to consists of multiple discrete components (like a mobile app, reverse proxy, the Visitz middleware API, etc.). However, it also could be reused for other projects as a common component.

As another piece of that solution, where do we want to store this project's code?

## Decision Drivers

* Keep codebase organized and focused
* Apply separation of concern to components of the overall solution

## Considered Options

* Store project code in its own repository
* Store project code in Visitz repository

## Decision Outcome

Chosen option: "Store project code in its own repository", because it best satisfies the decision drivers.

### Consequences

* Good, because applying separation of concern helps organize components of the overall solution in a meaningful way.
* Bad, because we must keep track of the individual repositories that make up the overall solution.

## Pros and Cons of the Options

### Store project code in its own repository

* Good, because tracking a single codebase in a repository is simpler
* Good, because configurations can be set up at a repository level without worrying about collisions with namespacing or conflicting with other configurations
* Good, because it allows this component to be reused across other projects
* Bad, because the overall solution this project is a part of is split across multiple repositories

### Store project code in Visitz repository

* Good, because more of the implementation of the application is stored in a single place
* Bad, because it's easier to run into collision issues with namespacing or configurations
* Bad, because it can muddy the waters of what is and is not part of the core API functionality for Visitz.
