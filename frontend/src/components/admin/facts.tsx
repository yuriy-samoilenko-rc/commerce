type Row = readonly [string, React.ReactNode];

/** Label/value pairs; falsy rows are skipped, so optional facts can be written inline. */
export function Facts({ rows }: { rows: (Row | null | false | "" | 0 | undefined)[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows
        .filter((row): row is Row => !!row)
        .map(([label, value]) => [
          <dt key={`${label}-t`} className="text-muted-foreground">
            {label}
          </dt>,
          <dd key={`${label}-d`} className="break-words">
            {value}
          </dd>,
        ])}
    </dl>
  );
}
