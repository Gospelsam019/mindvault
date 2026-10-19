# MCP timeout bounds

Every timeout budget the MCP server is configured with must fit inside the
request deadline of the transport (the MCP client). Otherwise the client gives
up first while the tool keeps running, and the agent sees a transport error for
a call that may still commit.

`MINDVAULT_TRANSPORT_DEADLINE_MS` is the effective deadline (default `300000`).
Set it to the request timeout your MCP client enforces. `0` turns the check off.

At startup the server checks:

- every `MINDVAULT_TOOL_TIMEOUTS` override is greater than `0` and not above the deadline
  (an override of `0` means "no deadline", which cannot fit inside a finite deadline);
- every non-zero service budget (`MINDVAULT_*_TIMEOUT_MS`) is not above the deadline.

An invalid combination aborts startup with a message that lists each offending
entry. A malformed `MINDVAULT_TRANSPORT_DEADLINE_MS` also aborts startup.

Example: with a client that times out at 60 seconds,

```
MINDVAULT_TRANSPORT_DEADLINE_MS=60000
MINDVAULT_TOOL_TIMEOUTS="mindvault_publish=50000"
```

is valid, while `mindvault_publish=90000` is rejected.

See also [mcp-timeouts-retries.md](../mcp-timeouts-retries.md).
