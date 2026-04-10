# Modmod Component Context Support

Comparison target:
- `c:\dev\modmod\src\components`
- `c:\dev\modmod\src\common\ModModContext.js`
- `src/gc/common/GameCenterContext.js`
- `src/gc/main/App.jsx`

Current `GameCenterContext` usage in this repo effectively provides:
- `registry`
- `mainPages`

To support the filtered reusable `modmod` components, the minimal additional context surface needed is:

## Needed Properties

- `localize`
- `editVariant`
- `registry`
- `locale`

## Expected Support By Property

### `localize`

Used by most controls and display helpers.

Expected methods/events:
- `t(key, replacements?)`
- `t_locale(locale, key, replacements?, cardinal?)`
- `listen(eventName, handler)`

Observed events:
- `newLocale`
- `updated`

### `editVariant`

Used by MUI form wrappers to choose an input variant.

Typical values:
- `'outlined'`
- `'filled'`
- `'standard'`

### `registry`

Used by:
- `LocaleString.jsx`
- `Date.jsx`
- `EditableComboBox.jsx`

Observed purposes:
- localization service wiring
- constructing `IntlDate`
- composing emoticon behavior

### `locale`

Used by:
- `Date.jsx`

Observed purpose:
- detect locale changes and rebuild formatted date handling

## Per-Component Dependency Map

### Depends on `localize` and `editVariant`

- `BaseCheckbox.jsx`
- `BaseRadioButtons.jsx`
- `BaseSelect.jsx`
- `NumberInput.jsx`
- `FloatNumberInput.jsx`
- `PasswordInput.jsx`
- `TextInput.jsx`
- `TimeInput.jsx`

### Depends on `localize` only

- `CodeMirrorInput.jsx`
- `FormMessage.jsx` via `LocaleString`
- `HelperText.jsx` via `LocaleString`

### Depends on `localize` and `registry`

- `LocaleString.jsx`

### Depends on `localize`, `registry`, and `locale`

- `Date.jsx`

### Depends on `localize`, `registry`, and `editVariant`

- `EditableComboBox.jsx`

### No context dependency from the filtered list

- `RoundedButton.jsx`
- `ColorSelector.jsx` when used alone
- `PasswordComplexity.jsx` if used as display-only logic

## Practical Outcome For `poly-gc-react`

`registry` already exists in `GameCenterContext`.

The main missing properties are:
- `localize`
- `editVariant`
- `locale`

## Required Registry Services

For the filtered component set, assuming emoticon support is removed from `EditableComboBox.jsx`, the required registry services are:

- `localize`
- `data-cache`

### Direct Service Usage

- `LocaleString.jsx`
  - `localize`
- `Date.jsx`
  - `localize`
  - `data-cache`

### Indirect Service Usage

- `HelperText.jsx`
  - via `LocaleString.jsx` -> `localize`
- `FormMessage.jsx`
  - via `LocaleString.jsx` -> `localize`

## Other Required Context Properties

Beyond registry-backed services, the filtered component set needs these context properties:

- `localize`
- `editVariant`
- `locale`

### Why They Are Needed

- `localize`
  - translation access for labels, helper text, and localized strings
- `editVariant`
  - shared default Material UI form control variant
- `locale`
  - current locale for date formatting and locale-change handling

## Package Dependencies

The filtered component set depends on these packages:

- `@mui/material`
- `@mui/icons-material`
- `@mui/x-date-pickers`
- `dayjs`
- `html-react-parser`
- `@uiw/react-codemirror`
- `@codemirror/state`
- `@codemirror/view`
- `react-best-gradient-color-picker`
- `@ondohers/case`
