# Modmod TextInput Dependencies

Focused dependency inventory for `c:\dev\modmod\src\components\TextInput.jsx`.

## File Dependency

- `TextInput.jsx`

## Imports

- `@mui/material/TextField`
- `common/ModModContext.js`

## Required Context Properties

- `localize`
- `editVariant`

## Expected `localize` Support

- `t(key, replacements?)`

## Registry Service Dependency

`TextInput.jsx` does not directly subscribe to registry services.

## Practical Support Needed

1. `TextInput.jsx`
2. `@mui/material`
3. context support for:
   - `localize.t(...)`
   - `editVariant`
