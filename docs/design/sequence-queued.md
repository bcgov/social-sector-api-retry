```mermaid
---
title: Submit memo retry mechanism - ICM downtime, request queued
---
sequenceDiagram
    autonumber

    actor User as Downstream<br>User agent flow
    participant Retry as Retry API
    participant Icm as ICM REST framework¹
    participant Email as Mail server

    note over Retry: Managed Container Services <br> Private Cloud Silver Tier <br> (MCS-Silver)

    alt Inbound API call
        rect rgba(200,200,200,0.3)
            User->>Retry: Provide memo information<br>with user id and email
        end
    else Webhook notification
        rect rgba(200,200,200,0.3)
            User->>Retry: Notify of submission via webhook
            Retry->>User: Retrieve memo submission<br>with user id and email
        end
    end

    Retry->>Icm: Authenticate with client credentials
    Icm->>Retry: Return JWT tokens

    Retry->>Icm: Attempt memo submission<br/> (request with username header & id JWT)

    rect rgba(255, 180, 0, 0.3)
        Icm->>Retry: Return 503 SERVICE UNAVAILABLE
        Retry->>Retry: Store and queue submission

        alt Inbound API call
            Retry->>User: Return 202 ACCEPTED
        else Webhook notification
            Retry->>Email: Notify user by email: <br> submission accepted and queued
        end

        Retry->>Retry: Wait for ICM to restore services²
    end

    loop
        rect rgba(200,200,200,0.3)
            opt if JWT expired
                Retry->>Icm: Authenticate with client credentials
                Icm->>Retry: Return JWT tokens
            end
        end

        Retry->>Icm: Dequeue and attempt next memo submission<br>(request with username header & id JWT)

        alt Success
            rect rgba(0, 180, 0, 0.3)
                Icm->>Retry: Return 2xx
                Retry->>Email: Notify user by email: <br> submission successfully entered into ICM
            end
        else Error
            rect rgba(180, 0, 0, 0.3)
                Icm->>Retry: Return 4xx / 5xx
                Retry->>Email: Notify user by email: <br> submission failed & submission will be <br> sent to shared inbox for manual entry
                Retry->>Email: Send submission to pre-configured shared inbox
            end
        end
    end

```

Additional information:

1. [ICM REST framework](https://dev.azure.com/bc-icm/SiebelCRM%20Lab/_wiki/wikis/SiebelCRM-Lab.wiki/575/Siebel-Application-Client-ID-(Service-Account)-Operation-for-DATA-API)

2. Logic TBD. Could be polling/retrying against 503, subscribing to another uptime service, some combination of the two, or something else entirely.
