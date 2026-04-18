
User wants all 8 upgrades built. I'll sequence them in dependency order across ~4 batches so each batch is shippable and testable on its own. Keep concise — user has already approved the high-level vision; this plan is the build sequence.

Order rationale:
- Memory first (everything reads from it)
- Preferences next (cheap, plugs into prompt)
- Confirm-before-act (small, prevents wrong actions before we add proactivity)
- Proactive Telegram + voice replies (visible value)
- Cross-module inference (prompt + tool upgrade)
- Email autopilot (background job)
- Multi-step planning (biggest, last)
