# Project State

Last verified commit: tip of `main` after the 2026-05-01 portfolio cleanup chunk (see `docs/journal/2026-05.md`). Prior verified commit was `9d7ddee` (pricing verification, 2026-04-23).

Active task: post-cleanup follow-ups, then resume product work per Kyle's current priority. Trial dashboard, vendor console, farmer dashboard, and Telegram inbox are all live as of `9d7ddee`.

Known blockers: none.

Next action: pick the next item from `docs/plans/`.

Agent/skill inventory: zero project-local agents, zero project-local skills. `.claude/agents/` and `.claude/skills/` exist as empty scaffolds for future bio_trial-specific helpers.

Cleanup decisions on record:
- `docs/inquiries/` is the canonical Dusty/ReLineHybrids seed-rep scenario location and is tracked.
- `video/` and `remotion-video/` are both kept and tracked. Each has its own `.gitignore` excluding `node_modules/`, `out/`, and rendered video files.
- `video/` is now self-contained: `Biostim.jpg` and the verification screenshots used by `video/src/FarmerExplainerReel.jsx` were moved in from root.
- Root `.gitignore` anchors screenshot patterns to the project root so subdir copies can ship; `.claude/agents/**` and `.claude/skills/**` are negated so future helpers track.
- `.codex/config.toml` scaffolded with `model = "gpt-5.5"` and `reasoning_effort = "medium"`.
