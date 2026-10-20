# Catalog search term normalization

The MCP client re-applies the keyword filter locally (`applyClientCatalogFilters`)
so results stay correct against cached snapshots and backends that ignore the
`search` parameter. To return the same resources as the server for equivalent
text, both the keyword and the searched text (`title` + `description`) are
normalized with `normalizeSearchTerm` (`mcp/src/catalogSearchTerm.ts`):

1. Unicode NFC, so `café` and `café` are the same term.
2. Locale-independent lower-casing.
3. Whitespace runs (including NBSP) collapse to one space; edges are trimmed.

Tags, owner, and ids are not affected. Behavior for plain ASCII keywords is
unchanged apart from whitespace collapsing.
