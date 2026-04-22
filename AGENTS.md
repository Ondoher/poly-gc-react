# Topic Bootstrap

On bootstrap, read these lightweight shared context files:

- [Topics Index](/c:/dev/poly-gc-react/agents/topics/README.md)
- [Architecture Overview](/c:/dev/poly-gc-react/agents/topics/architecture/architecture-overview.md)

Use the topics index as a routing table, and use the architecture overview as
always-on high-level architecture context. Do not load topic-specific documents
until the user's task clearly asks for that topic or the needed context cannot
be inferred from the current code/files.

Working conventions:

- Prefer CSS background images for decorative or layout-affecting assets such as frames, corners, borders, and chrome.
- Prefer `<img>` tags for content images where intrinsic image semantics matter.
- Prefer CSS Grid as the primary layout system for arranging major UI regions and HUD elements where it fits naturally.
- Use React/JSX to define semantic boxes and regions, and use CSS to place those regions within the layout.
- For file naming, placement, and JSDoc style, consult [Naming And Placement Conventions](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md#naming-and-placement-conventions) when creating or moving files, or when naming/JSDoc style is relevant.
