# tekjobs-app

Created with `zengin create` from the **saas** template. The components in `src/components/ui` are yours: edit them, the engine keeps everything else on the system they define.

```bash
npm install
npm run dev          # http://localhost:5173
npm run storybook    # http://localhost:6006
npm run check        # zengin check: every file in src against zengin/
npm run add -- select switch   # more components from the registry
```

## Where things are

| Path | What |
| --- | --- |
| `src/components/ui/` | Avatar, Badge, BarChart, Button, Card, Icon, Dialog, LineChart, Menu, Popover, Progress, Select, Separator, Sheet, Sparkline, Switch, Table, TextArea, TextField, Toast, Tooltip. Each file carries a `zengin-owned` pragma with the version it was copied from, so a rollup can tell how far it has drifted. |
| `zengin/` | `tokens.json`, `tokens.dark.json`, `components.json`: the definitions the engine enforces against. |
| `src/theme/brand.css` | Your brand as token overrides. The one place literals are allowed. |
| `src/styles/` | The base stylesheet and the component imports. `generated/tokens.css` is built by `zengin tokens`. |
| `zengin.config.yaml` | The policy. Every rule at error. |
| `.mcp.json`, `.claude/settings.json` | The MCP server and the edit hook, so agents working here are checked as they write. |
