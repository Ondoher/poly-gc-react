# Modmod Generic Components

Filtered inventory from `c:\dev\modmod\src\components`, excluding:
- layout-oriented components
- markdown-related components
- dialog-related components
- `BaseAlertableComponent.jsx`

Rule:
- Keep components where emoticon handling is only an optional supported feature.
- Exclude components where emoticon support is the primary purpose.

Assumptions:
- `EditableComboBox.jsx` stays in the list only if emoticon-specific behavior is removed or ignored during port.
- `ColorSelector.jsx` and `ColorPickerDialog.jsx` are treated as reusable color-input pieces rather than dialog-specific exclusions.

## Form Controls

- `BaseCheckbox.jsx`
- `BaseRadioButtons.jsx`
- `BaseSelect.jsx`
- `CodeMirrorInput.jsx`
- `ColorPickerDialog.jsx`
- `ColorSelector.jsx`
- `Date.jsx`
- `EditableComboBox.jsx`
- `FloatNumberInput.jsx`
- `NumberInput.jsx`
- `PasswordInput.jsx`
- `RoundedButton.jsx`
- `TextInput.jsx`
- `TimeInput.jsx`

## Content Display

- `FormMessage.jsx`
- `HelperText.jsx`
- `LocaleString.jsx`
- `PasswordComplexity.jsx`

## Emoticon-Specific Exclusions

- `EmoticonComponent.jsx`
