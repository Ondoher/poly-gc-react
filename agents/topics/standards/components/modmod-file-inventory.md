# Modmod File Inventory

File inventory needed to support the current filtered reusable component set, including `ColorPickerDialog.jsx` and assuming `EditableComboBox.jsx` is kept but emoticon support is removed.

## Top-Level Components

From `c:\dev\modmod\src\components`:

- `BaseCheckbox.jsx`
- `BaseRadioButtons.jsx`
- `BaseSelect.jsx`
- `CodeMirrorInput.jsx`
- `ColorPickerDialog.jsx`
- `ColorSelector.jsx`
- `Date.jsx`
- `EditableComboBox.jsx`
- `FloatNumberInput.jsx`
- `FormMessage.jsx`
- `HelperText.jsx`
- `LocaleString.jsx`
- `NumberInput.jsx`
- `PasswordComplexity.jsx`
- `PasswordInput.jsx`
- `RoundedButton.jsx`
- `TextInput.jsx`
- `TimeInput.jsx`

## Required Support Files

From `c:\dev\modmod\src\common`:

- `ModModContext.js`
  or equivalent behavior folded into `GameCenterContext`
- `IntlDate.js`

## Optional / Conditional Support Files

Only if `EditableComboBox.jsx` keeps its current internal composition pattern:

- `compose.js`
- `utils.js`

If emoticon support is fully removed from `EditableComboBox`, these are not needed:

- `EmoticonComponent.jsx`
- `compose.js`
- `utils.js` for `shortId` / `debounce`
- any `emoticons` service support

## Required Assets

From `c:\dev\modmod\src\icons`:

- `CrossCircle.svg`
- `TickCircle.svg`

Supports:
- `PasswordComplexity.jsx`

## Required Styles

- `assets/styles/code-mirror-input.css`

Supports:
- `CodeMirrorInput.jsx`

## Required Context / Service Support

Context properties needed:
- `registry`
- `localize`
- `editVariant`
- `locale`

Registry services needed:
- `localize`
- `data-cache`

## Package Dependencies

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

## Smallest Practical Copy Set

1. The 18 component files listed above
2. `IntlDate.js`
3. `CrossCircle.svg`
4. `TickCircle.svg`
5. `code-mirror-input.css`

And implement in this repo:
- `localize`
- `editVariant`
- `locale`
- `data-cache`
