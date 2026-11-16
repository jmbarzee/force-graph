# sdlc mapping

Binds [the `sdlc` lifecycle](https://github.com/metacensus/skills/blob/main/skills/sdlc/SKILL.md) to this repository. A personal account has no issue types, so a title's prefix states the type (`Epic:`, `Task:`, `Bug:`, `Spike:`).

## Labels

| Role | Label | Description |
|---|---|---|
| ready | agent-ready | Meets its form; may be picked up |
| designed | designed | A person can read the issue alone and know what will be built |
| deviated | deviated | Done differently than planned; see the closing comment |
| reached-up | reached-up | Its work rewrote the parent |
| newcomer | good first issue | Small and self-contained, for a first contribution |
| help | help wanted | Open to an outside contributor |

## Boards

| Board | Initiatives | Purpose |
|---|---|---|

## Roles

| Role | Who |
|---|---|
| delegator | jmbarzee |
| reviewer | a fresh `sdlc-review` agent; the merge is jmbarzee's |

## Checks

| Stage | Paths | Check |
|---|---|---|
| Implement | * | `make check` exits 0 |
