---
name: spec-attack
description: Use before building or auditing against acceptance contracts - systematically finds missing acceptance dimensions so "all green but wrong" cannot ship through contract holes.
---

# Spec Attack

The most dangerous defect is the one the contract never tests for. Attack the contract before anyone spends effort satisfying it. For each unit, walk this checklist and emit a concrete `proposed_cmd` per hole:

- **Performance**: is there any latency/throughput/memory bound? A contract with zero perf commands accepts a 100x regression.
- **Security**: injection surfaces, authz boundaries, secret handling, path traversal. Does any acceptance command exercise them?
- **Concurrency & ordering**: parallel invocation, reentrancy, lock ordering, idempotency under retry.
- **Boundary semantics**: empty input, maximum size, unicode/encoding, negative/zero, off-by-one at documented limits.
- **Error paths**: does acceptance only test the happy path? Force the failure modes and check the contract covers observed behavior.
- **Resource lifecycle**: file handles, connections, temp files, cleanup on failure.
- **Compatibility**: documented API/CLI surface stability, serialization format round-trips across versions.

Rules:
- A hole without an executable `proposed_cmd` is an opinion — make it testable or drop it.
- Rank holes by blast radius, not by ease of writing the test.
- Output feeds the contract patch step; you never modify contracts yourself.
