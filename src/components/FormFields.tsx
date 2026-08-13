import type { ReactNode } from "react";

type Option<T extends string> = {
  value: T;
  label: string;
};

export function ChoiceGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = 2,
}: {
  name: string;
  value: T | "";
  onChange: (value: T) => void;
  options: readonly Option<T>[];
  columns?: 2 | 3;
}) {
  return (
    <div>
      <div
        className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`min-h-12 rounded-2xl border py-3 text-center font-semibold transition ${
                columns === 3 ? "px-2 text-sm sm:text-base" : "px-3 text-base"
              } ${
                selected
                  ? "border-brand-dark bg-brand-dark text-white"
                  : "border-stone-300 bg-white text-stone-800 active:bg-brand-bg"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

export function ToggleChip({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`min-h-12 w-full rounded-2xl border px-3 py-3 text-center text-base font-semibold transition ${
          checked
            ? "border-brand-dark bg-brand-dark text-white"
            : "border-stone-300 bg-white text-stone-800 active:bg-brand-bg"
        }`}
      >
        {children}
      </button>
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
    </div>
  );
}

export function Question({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-brand-bg/70 p-4">
      <h2 className="text-base font-extrabold leading-snug text-stone-900">
        <span className="text-brand-dark">{number}.</span> {title}
      </h2>
      {hint ? (
        <p className="mt-1 mb-3 text-sm leading-relaxed text-stone-600">{hint}</p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
    </section>
  );
}
