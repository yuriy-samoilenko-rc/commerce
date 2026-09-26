import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/** A select inside a GET filter form: its value lands in the query string. */
export function FilterSelect({
  name,
  label,
  value,
  options,
  all,
}: {
  name: string;
  label: string;
  value?: string;
  /** code → text, or [code, text] pairs when the order matters. */
  options: Record<string, string> | [string, string][];
  /** Text of the "no filter" option; omit when a value is always chosen. */
  all?: string;
}) {
  const entries = Array.isArray(options) ? options : Object.entries(options);
  return (
    <NativeSelect name={name} defaultValue={value ?? ""} aria-label={label}>
      {all !== undefined && <NativeSelectOption value="">{all}</NativeSelectOption>}
      {entries.map(([code, text]) => (
        <NativeSelectOption key={code} value={code}>
          {text}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** Only values the API knows go through; anything else would be a 400. */
export function pickParam(value: string | string[] | undefined, allowed: Record<string, string> | string[]) {
  if (typeof value !== "string") return undefined;
  return (Array.isArray(allowed) ? allowed.includes(value) : value in allowed) ? value : undefined;
}
