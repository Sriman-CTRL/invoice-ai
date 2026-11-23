@AGENTS.md

## Claude Code specifics

- At the start of every session, read `docs/PROJECT-HISTORY.md` before proposing work.
- When a piece of work lands, update the "Status" and "Next" sections of `docs/PROJECT-HISTORY.md` (and add a timeline row)
  in the same commit, so context survives `/clear`.
- If a rule in `AGENTS.md` turns out wrong or a new pitfall bites, fix `AGENTS.md` in the same change.
