---
description: Run the Hyperworkflows time plane now (merge/nightly/weekly probe suites) or install the nightly schedule
argument-hint: "[merge|nightly|weekly|install]"
---

Time-plane operations. Argument: `$ARGUMENTS` (default: `merge`).

**If the argument is `install`**
Run `sh ${CLAUDE_PLUGIN_ROOT}/scripts/sentinel-install.sh` and show its output (three scheduling options). Only run with `--install-launchd` if the human explicitly picks option A. Note plainly: the launchd job fires at 02:30 machine-local time; confirm the machine timezone is Asia/Singapore.

**Otherwise (merge | nightly | weekly)**
1. `head` = `git rev-parse --short HEAD`; `date` = today (Asia/Singapore); `run_id` = `sentinel-<date>-<mode>`. Create `runs/<run_id>/` (mkdir -p), write `runs/ACTIVE`.
2. Run the engine shipped with this plugin: prefer the plugin-registered `hypersentinel` workflow if invocable by name; otherwise read `${CLAUDE_PLUGIN_ROOT}/workflows/hypersentinel.js` and execute it as a dynamic workflow with `{head, date, mode, run_id}`. (A project-local copy from optional `/hyperworkflows:init` takes precedence.)
3. On completion:
   - No new regressions: one line — "Sentinel <mode>: no new regressions vs last-good (<baseline head>)." Plus fixed-count if any disappeared.
   - New regressions: render each with suite, fingerprint, bisected culprit commit (when auto-bisect resolved), and the evidence command. Write `runs/<run_id>/fix-request.md` ready for `/hyperworkflows:apply`. NEVER advance `memory/last-good.json` on a red run.
   - Advance `memory/last-good.json` ONLY when the run is green AND the human confirms (or the previous baseline was null).
4. Persist verdict files (probe exit codes) and remove `runs/ACTIVE`.
