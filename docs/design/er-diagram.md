```mermaid
erDiagram
    REQUEST {
        uuid id
        text email
        text first_name
        text last_name
        text upstream_type
        text outbound_url
        text http_method
        JSONB headers
        JSONB params
        text content_type
        text body
        JSONB webhook_headers
        JSONB webhook_params
        text webhook_content_type
        text webhook_body
        text overall_status
        int latest_upstream_error_code
        text latest_upstream_error_message
    }
```
## Enum values
upstream_type: Siebel 
overall_status: Webhook received, Added to inbound queue, Webhook response initiatied, Webhook data retrieved, REST data recieved, Waiting in outbound queue, Trying upstream, Upstream success, Upstream error, Notify error, Notify success
