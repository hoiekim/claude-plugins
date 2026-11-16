# claude-plugins

Claude Code plugins for the `hoiekim` repositories, published as a plugin
marketplace.

| Plugin | What it does |
| --- | --- |
| [`reviewoie-loop`](plugins/reviewoie-loop) | When PR auto-fix is turned on for a `hoiekim/*` PR, request a review from `reviewoie`, wait for it, address the findings and re-request until it approves. |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install reviewoie-loop --marketplace hoiekim/claude-plugins
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in
every session you start after).

From a shell:

```bash
claude plugin install reviewoie-loop --marketplace hoiekim/claude-plugins
```

In the desktop app, where `/plugin` does not run: click + next to the prompt
box, then Plugins, Add marketplace with `hoiekim/claude-plugins`, then Add
plugin.

### In a repository's settings

To have every session in a repository load it, cloud sessions included, add
this to that repository's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "hoiekim": { "source": { "source": "github", "repo": "hoiekim/claude-plugins" } }
  },
  "enabledPlugins": { "reviewoie-loop@hoiekim": true }
}
```

While this repository is private, installing needs a git credential for
github.com that can read it.
