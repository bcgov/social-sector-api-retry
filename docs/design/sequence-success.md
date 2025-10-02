```mermaid
---
title: Submit memo retry mechanism - ICM up, request successful
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

    rect rgba(0, 180, 0, 0.3)
        Icm->>Retry: Respond normally

        alt Inbound API call
        rect rgba(200,200,200,0.3)
            Retry->>User: Forward response
        end
        else Webhook notification
            rect rgba(200,200,200,0.3)
                Retry->>Email: Notify user by email: <br> successfully submitted to ICM
            end
        end
    end
```

Additional information:

1. [ICM REST framework](https://dev.azure.com/bc-icm/SiebelCRM%20Lab/_wiki/wikis/SiebelCRM-Lab.wiki/575/Siebel-Application-Client-ID-(Service-Account)-Operation-for-DATA-API)
