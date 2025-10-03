## State machine for overall logic
Each of these steps (with the exception of dequeue) are saved alongside submissions as a status. In the event of an unexpected crash, they can be resumed from their given state.
```mermaid
flowchart TD
 start[Start]
 hookReceived[Webhook received]
 inboundQueue[Added to inbound queue]
 hookResponse[Webhook response initiatied]
 getHookData[Webhook data retrieved]
 restReceived[REST data received]
 outboundQueue[Waiting in outbound queue]
 tryUpstream[Trying upstream]
 upstreamSuccess[Upstream success]
 upstreamUnavailable[Upstream unavailable]
 upstreamError[Upstream error]
 notifyError[Notify error]
 notifySuccess[Notify success]
 dequeue[Dequeue]
 finish[End]
 hookReceived --> inboundQueue --> hookResponse --> getHookData --> outboundQueue
 start --> hookReceived
 start --> restReceived --> outboundQueue --> tryUpstream
 tryUpstream --> upstreamSuccess --> notifySuccess --> dequeue --> finish
 tryUpstream --> upstreamUnavailable --> outboundQueue
 tryUpstream --> upstreamError --> notifyError --> dequeue
```