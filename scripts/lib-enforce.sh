# Hyperworkflows enforcement level resolver. Sourced by hook scripts:
#   . "$(dirname "$0")/lib-enforce.sh"; LEVEL=$(hyperworkflows_level)
#
# Resolution order (consent architecture):
#   1. HYPERWORKFLOWS_ENFORCE env var (explicit, wins)
#   2. .hyperworkflows/enforce file in the project (set via /hyperworkflows:enforce 0|1|2)
#   3. Default: 1 if the project carries Hyperworkflows markers, else 0.
# Markers are deliberately specific (never generic dirs like runs/ or memory/,
# which other tooling also creates): .hyperworkflows/, memory/router.md, evidence/.
#
# Levels: 0 = ambient only | 1 = salience (constitution + drumbeat + nudges)
#         2 = adds session gates (disclosure-mode Stop gate, mutation sensor)

hyperworkflows_level() {
  lvl="${HYPERWORKFLOWS_ENFORCE:-}"
  if [ -z "$lvl" ] && [ -f .hyperworkflows/enforce ]; then
    lvl=$(head -c 4 .hyperworkflows/enforce | tr -cd '0-9')
  fi
  if [ -z "$lvl" ]; then
    if [ -d .hyperworkflows ] || [ -f memory/router.md ] || [ -d evidence ]; then lvl=1; else lvl=0; fi
  fi
  case "$lvl" in 0|1|2) ;; *) lvl=1 ;; esac
  echo "$lvl"
}
