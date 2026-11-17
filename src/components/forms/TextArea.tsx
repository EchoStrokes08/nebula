import { TextField, type TextFieldProps } from '@/components/forms/TextField';

/** Campo multilínea (notas, diario, descripción). */
export function TextArea({ numberOfLines = 4, ...rest }: Omit<TextFieldProps, 'secure' | 'multiline'>) {
  return <TextField {...rest} multiline numberOfLines={numberOfLines} textAlignVertical="top" minInputHeight={numberOfLines * 22} />;
}
