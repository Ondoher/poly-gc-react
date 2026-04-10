# Component Porting Guidance

For `poly-gc-react`, the filtered `modmod` components should be treated primarily as reference material, not automatic port targets.

Reasons:
- this application is mainly a game app
- the UI is themed and frame-driven rather than standard business-app UI
- mobile layout support is important
- Material UI look and feel may not fit the desired presentation

Implication:
- it may be better to borrow ideas, behavior, validation patterns, and context/service conventions from `modmod`
- and not copy the actual MUI-based components at all

Most reusable takeaways may be:
- localization patterns
- validation behavior
- naming and organization
- lightweight control APIs
- context/service expectations

Rather than:
- direct reuse of standard MUI form controls
- direct reuse of MUI dialog and field presentation
