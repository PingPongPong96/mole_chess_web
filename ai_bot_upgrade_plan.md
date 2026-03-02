# AI Bot Upgrade Plan

## Goal
- Keep AI intelligence consistent between PC and mobile.
- Support fully offline runtime with pre-trained model.
- Reach practical strength that can beat advanced human designers.

## Strategy
- Prioritize consistency first, then peak strength.
- Use search-first decision making, with trained model as evaluation/policy assist.
- Train in Python and export to ONNX.
- Run inference locally in JS/WASM with Web Worker isolation.

## Runtime Scope
- Primary runtime target: `mole_chess_portable.html` and normal web runtime.
- Bundle local runtime dependencies with project assets.
- Keep existing fallback logic and add structured decision logs/monitoring.

## Performance and UX
- Per-move latency budget: <= 5 seconds.
- Provide 3 difficulty levels (easy/normal/hard) with stable behavior.

## KPI
- New AI self-play win rate against current AI: >= 80%.

## Delivery Notes
- Implement and validate model path after current game-mechanic bug fixes are complete.
- Keep deterministic debug mode hooks for offline reproducibility.
