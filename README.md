# Scope Analytics — Claude Code plugin

[Scope](https://scopeai.dev) is the **AI analyst for AI products**. This plugin connects
Claude Code to Scope so you can **set up** a Scope project, **install** Scope in your code, and **ask
questions about your analytics** — user behavior, sessions, and LLM interactions — in natural language,
without leaving your editor.

It bundles the [`scope-analytics-mcp`](https://pypi.org/project/scope-analytics-mcp/) MCP
server, fetched and run on demand via `uvx` (nothing to install first).

## Install

```text
/plugin marketplace add wally827/scope-mcp-plugin
/plugin install scope-analytics-mcp@scopeai
```

**No key to paste.** The first time Claude Code uses Scope, it links your project: Scope opens in
your browser, you sign in (or sign up), type the code Claude Code shows, pick or create the
project, and approve. The link gets its own key — revocable in Scope's Setup → Keys — which Claude
Code saves only to an env file git won't commit, and the plugin finds it there next time.

> Requires [`uv`](https://docs.astral.sh/uv/) (which provides `uvx`).

## What you can ask

- *"Set up Scope for this project."* → link → install → suggested settings → status
- *"Use Scope to install analytics in this project."* → detect stack → install → verify
- *"What does Scope cover for my app?"* → coverage report
- *"Ask Scope why signups dropped this week."* → the analyst
- *"Show me what user `u_123` did in their last session."* → a stitched session

The install tools only **propose** code changes — Claude Code shows them and applies them on your
confirmation — and the set-up tools only **suggest** settings, which change nothing until you accept
them in Scope. Scope never edits your files or account on its own.

## Tools

- **Set up (no key needed):** `scope_link_project`, `scope_link_wait`, `scope_save_key`,
  `scope_propose_setup`, `scope_setup_status`, `scope_slack_connect_link`
- **Install / coverage:** `scope_detect_stack`, `scope_install_frontend`, `scope_install_backend`,
  `scope_verify_installation`, `scope_supported_integrations`, `scope_check_integration`,
  `scope_coverage_report`
- **Query:** `scope_ask` (the analyst), `scope_get_stats`, `scope_query_events`,
  `scope_get_session`, `scope_list_metrics`, `scope_get_metric`

## Privacy

Runs locally; talks only to the Scope backend (`api.scopeai.dev`) with your key — no data
goes to Anthropic. See [PRIVACY.md](./PRIVACY.md) and the full
[privacy policy](https://scopeai.dev/privacy-policy).

## Links

- Website — https://scopeai.dev
- Package — https://pypi.org/project/scope-analytics-mcp/
- MCP registry — `io.github.wally827/scope-analytics-mcp`

## License

[MIT](./LICENSE)
