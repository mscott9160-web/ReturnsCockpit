# Maya Chen Design Review

## Product Direction

Keep the name **Returns Cockpit**. It is a clear portfolio-understanding workspace for beginner and experienced investors. Pair it with the descriptor:

> Understand your portfolio with clarity.

The product must explain recorded portfolio behavior without guaranteeing profit or presenting unexplained personalized investment advice.

## Visual System

Keep the current navy, teal, coral, gold, and soft green-gray palette.

- Deep navy: navigation and primary structure
- Teal: positive, active, and freshness states
- Coral: primary actions and clearly labeled negative values
- Gold: informational or attention states
- Gray: unavailable or stale states

Do not use color as the only signal. Pair gains and losses with text or symbols such as `gain`, `loss`, `stale`, `demo`, and `unavailable`.

Keep serif headings for a thoughtful editorial feel and use a clean sans-serif for metrics, labels, forms, and tables.

## Required Improvements

1. Remove corrupted or mojibake characters from navigation, statuses, activity rows, close controls, and delete controls.
2. Remove leftover Vite starter CSS and keep one authoritative Returns Cockpit design-token system.
3. Make demo, fresh, stale, and unavailable data states prominent and understandable with source and timestamp context.
4. Make transaction terminology and field behavior clear for buy, sell, dividend, fee, deposit, and withdrawal.
5. Improve modal accessibility: visible focus, Escape-to-close, initial focus, focus restoration, and validation status.
6. Replace native destructive confirmation where practical with an intentional accessible confirmation flow.
7. Add purposeful empty, loading, saving, saved, failed, retry, and unavailable states.
8. Make narrow-screen navigation understandable with accessible labels/tooltips.
9. Ensure positive and negative values remain understandable without color.
10. Clarify local demo versus authenticated workspace identity.

## Required State Coverage

- New empty workspace
- Local demo workspace
- Authenticated workspace
- Loading workspace
- Saving and saved transaction
- Save failure and retry
- Import success and rejected import
- Demo, fresh, stale, and unavailable prices
- Empty watchlist and activity
- No holdings
- Concentrated portfolio
- Positive and negative return

## Definition Of Done

- Desktop and mobile layouts are reviewed.
- Keyboard navigation and visible focus work.
- Dialog focus behavior is intentional and Escape closes it.
- Screen-reader labels and status announcements are meaningful.
- Long symbols, emails, values, and validation messages fit on mobile.
- Financial terms are consistent and plain-language.
- Destructive actions explain consequences.
- Demo/live data cannot be confused.
- No copy implies guaranteed returns or automated advice.

## Handoffs

Frontend owns component states and responsive implementation. Backend owns persistence, freshness metadata, and stable error categories. QA converts the state checklist into tests. Product approves terminology, scope, and the boundary between education and advice.
