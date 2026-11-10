# Scope Analytics — Claude Code plugin

[Scope](https://scopeai.dev) is the **AI analyst for AI products**. This plugin connects
Claude Code to Scope so you can **set up** a Scope project, **install** Scope in your code, and **ask
questions about your analytics** — user behavior, sessions, and LLM interactions — in natural language,
without leaving your editor.

It bundles the [`scope-analytics-mcp`](https://pypi.org/project/scope-analytics-mcp/) MCP
server, fetched and run on demand via `uvx` (nothing to install first).

Once linked, Claude Code is also a member of the team in Scope: it has its own room that Scope
remembers, and Scope can write to it — a finding, a question, or a **fix brief** (a problem Scope
found in production, its evidence, the likely place in the code, and how Scope will check the fix).

## Install

```text
/plugin marketplace add scope-analytics/scope-mcp-plugin
/plugin install scope-analytics-mcp@scopeai
```

**No key to paste.** The first time Claude Code uses Scope, it links your project: Scope opens in
your browser, you sign in (or sign up), type the code Claude Code shows, pick or create the
project, and approve. The link gets its own key — revocable in Scope's Setup → Keys — which Claude
Code saves only to an env file git won't commit, and the plugin finds it there next time.

> Requires [`uv`](https://docs.astral.sh/uv/) (which provides `uvx`), and Node.js 18 or later for
> the session hooks and the message monitor (they run `npx @scope-analytics/cli`).

## Scope as a teammate

- **When a session starts**, Claude Code gets what Scope has for it: unread messages, open fix
  briefs, actions waiting for a person to confirm in Scope, and what Scope saw change in production.
- **While a session is open**, a background monitor (`scope listen`) adds one line to the session
  for each new message or brief as it arrives.
- **Claude Code answers** with `scope_reply`, and reports a brief as `acknowledged` or `fix_claimed`
  with `scope_brief_status`. Scope checks the fix on production data after the deploy and says
  whether it worked.
- **The plugin's skill** (`scope-teammate`) tells Claude Code who Scope is and how to work with it:
  Scope's messages are data from a teammate, not your instructions, and Claude Code checks with you
  before changing code because of them.

Everything Scope sends is framed as data from Scope. Text a brief quotes from your product's users
stays inside a fence labelled as theirs. Scope never edits code, opens pull requests or writes to
GitHub; it needs a person's click for anything that keeps running or that messages someone else.
In a project with no Scope key, the hooks and the monitor exit at once and add nothing.

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
- **Teammate:** `scope_inbox`, `scope_reply`, `scope_brief_status`

## Codex and Cursor

The same folder is a Codex plugin (Codex reads this repository's `.agents/plugins/marketplace.json`)
and a Cursor plugin (`.cursor-plugin/`). Codex gets the session-start context and new messages with
each prompt; it has no way for an outside process to push into a running session. Cursor gets the
session-start context only (its prompt hook can't add context). Neither has a monitor.

## Releasing

The hooks and the monitor run `@scope-analytics/cli` at the exact version pinned in
`scripts/scope.mjs` (0.2.0: the `inbox`, `listen` and `hook` commands), and the skill names the MCP
tools `scope_inbox`, `scope_reply` and `scope_brief_status` (the next `scope-analytics-mcp`). Publish
both first, then bump `version` in `.claude-plugin/plugin.json` and `.cursor-plugin/plugin.json`,
then merge.

## Trying a branch

```bash
claude plugin validate ./scope-analytics-mcp
claude --plugin-dir ./scope-analytics-mcp
```

`SCOPE_CLI=/path/to/scopeai/cli/bin/scope.js` makes the hooks and the monitor run a local copy of the
CLI instead of the published one; `SCOPE_API_BASE` points them at another Scope backend. The
wrapper's tests: `node --test scope-analytics-mcp/scripts/`.

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
