```mermaid
---
title: Retry API architecture
---
flowchart TD
  User[User agent]
  IdBroker[OCIO-SSO]
  RevProxy[OCIO-APS]
  Retry[Retry API]
  Db[(DB Storage)]
  Icm[ICM REST framework]

  User --> |Authenticate with OIDC| IdBroker
  User --> |Request with access token| RevProxy

  RevProxy <--> |Introspect access token| IdBroker
  RevProxy --> |Forward request| Container

  subgraph Container["MCS-Silver"]
    direction TB
    Retry <--> Db
  end

  Retry <--> |Authenticate with client credentials| Icm
  Retry ----> |Request with ID token, append username header| Icm
```

Additional information:

- **MCS-Silver**: Managed Container Services - Private Cloud Silver Tier
- [ICM REST framework](https://dev.azure.com/bc-icm/SiebelCRM%20Lab/_wiki/wikis/SiebelCRM-Lab.wiki/575/Siebel-Application-Client-ID-(Service-Account)-Operation-for-DATA-API)
