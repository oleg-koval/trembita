# Skill Marketplace Publish Checklist

## 1) Validate package locally

```bash
npm run format
npm run typecheck
npm run test
npm pack --dry-run
```

## 2) Publish npm package (source distribution)

```bash
npm publish --access public
```

## 3) Marketplace submissions

### Cursor

- Bundle: `marketplaces/cursor/`
- Ensure `skill.manifest.json` + `SKILL.md` are present.
- Submit in Cursor marketplace publisher UI.

### Superpowers

- Bundle: `marketplaces/superpowers/`
- Ensure `skill.manifest.json` references `SKILL.md`.
- Submit through Superpowers publisher workflow.

### Claude ecosystem

- Bundle: `marketplaces/claude/`
- Ensure `skill.manifest.json` + docs links are valid.
- Submit through Claude plugin/skills channel.

### Codex

- Bundle: `marketplaces/codex/`
- Use metadata and `SKILL.md` as the compatibility adapter.
- Submit to Codex-target skill catalog flow used by your org.

## 4) Post-publish verification

- Search by: `trembita`, `http client`, `result pattern`, `agent skill`
- Verify install works in a clean workspace.
- Verify rendered docs include examples and quick links.
