"""The AI assistant (docs/features/ai-assistant.md): an AI client the
person runs (Claude Desktop through an MCP bridge) reads their exercise,
the knowledge base and the catalogs through the MCP endpoint, as that
person, with a personal access token.

- switch.py -- the instance switch and the responsible-use notice version.
- tokens.py -- personal access tokens, and authenticating with one.
- search.py -- in-memory search over the static catalogs.
- tools.py  -- the tools the MCP endpoint offers, with their guards.
- calls.py  -- the per-call record, rate limit and retention.
- mcp.py    -- the JSON-RPC protocol the endpoint speaks.
"""
