# React Code

Use this topic for guidance on writing React presentation code in this repo.
It starts with component structure, but it can grow to cover hooks, state,
events, forms, accessibility, and other React-specific implementation choices.

## Routing

Open this topic when the task involves:

- writing or refactoring React components
- deciding whether UI code belongs in React, a REMVC view service, or CSS
- organizing JSX for larger presentation surfaces
- deciding where component state, callbacks, and service interactions belong
- naming or placing React component files
- splitting React code into reusable or feature-local pieces

For broader feature ownership, service lifecycle, and placement rules, also use
[Feature Mechanics](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md).
For the architectural boundary between REMVC views and React presentation, use
[REMVC Architecture](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md#view-and-presentation).

## Core Framing

React is the presentation technology in this repo. It is not the whole REMVC
view layer.

In the preferred flow:

- controllers determine user-facing flow, behavior, and direction
- view services organize controller intent for presentation
- React components render concrete UI from props and local interaction state

React components should generally receive data, callbacks, and presentation
decisions from their owner instead of reaching directly into models or transport
logic.

## Component Shape

Current preferred pattern:

- files that contain React component classes are named in `PascalCase` after
  the class they contain
- most substantial React components should be implemented as classes by default
- truly stateless utility rendering can use plain functions when there is no
  meaningful common object model
- larger component renders should be broken into small focused render methods
  when the component has several distinct semantic regions
- render methods should express purposeful UI subregions such as control
  groups, metadata blocks, button stacks, previews, lists, and layout halves
- JSX should create explicit wrapper elements for those subregions rather than
  relying on CSS to infer structure from a flat list of children
- the component should own the markup and CSS classes for its internal
  organization

The practical goal is that JSX describes what boxes exist, while CSS describes
how those boxes behave visually.

## CSS And Layout

Current preferred pattern:

- keep component-local visual and internal layout rules in the component's own
  stylesheet when the component has one
- keep parent-level placement, sizing, and region positioning rules in the
  parent region stylesheet
- prefer CSS Grid for major UI regions when it fits naturally
- use React/JSX to define semantic boxes and regions, and use CSS to place
  those regions within the layout
- when a component needs materially different arrangements across modes such as
  landscape and portrait, keep the same semantic groups and change how those
  groups are laid out
- do not rewrite child lists for each layout mode unless the content really is
  different
- when a piece of UI content is conceptually separate from a control, make it a
  separate component region instead of burying it inside the control

Broad global stylesheets should stay broad. Component-specific layout, focus,
state, or interaction styling should live with the component or feature that
owns it.

## Interaction Boundaries

Current preferred pattern:

- React components should emit user intent through callbacks supplied by their
  owner
- controllers and models should own domain behavior, durable state changes, and
  persistence-facing decisions
- view services should translate controller state and intent into presentation
  props
- components can own transient UI state when it is local to the presentation,
  such as draft dialog selections or open/closed UI affordances
- if a non-service class needs a registry service, it should wait until its own
  runtime-ready point, such as `componentDidMount`, rather than subscribing in
  the constructor

This keeps React code focused on rendering and local interaction mechanics,
without making components responsible for application flow.

## Shared Vs Feature-Local Components

Component ownership follows reuse intent:

- components only meaningful inside one feature can live under that feature
- components useful across features should be promoted into an intentional
  shared component layer
- shared support files for those components should move with the component
- feature code should not quietly depend on internals from another feature

For pipeline-specific shared presentation, use the pipeline shared component
area when the component is only shared inside the pipeline app. For general GC
UI building blocks, use the broader shared component layer described in the
architecture topic.
