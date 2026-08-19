"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function SearchableSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Buscar...",
  disabled = false,
  required = false,
  fallbackOption,
  emptyMessage = "Nenhum resultado encontrado",
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  fallbackOption?: SearchableSelectOption;
  emptyMessage?: string;
}) {
  const listId = useId();
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const validityRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected =
    options.find((option) => option.value === value) ??
    (fallbackOption?.value === value ? fallbackOption : undefined);

  const filtered = useMemo(() => {
    const needle = normalizeText(query);
    if (!needle) return options;
    return options.filter((option) => {
      const haystack = normalizeText(
        `${option.label} ${option.description ?? ""}`
      );
      return haystack.includes(needle);
    });
  }, [options, query]);

  const visibleOptions = useMemo(() => {
    const next = [...filtered];
    if (
      fallbackOption &&
      !next.some((option) => option.value === fallbackOption.value)
    ) {
      next.push(fallbackOption);
    }
    return next;
  }, [fallbackOption, filtered]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    validityRef.current?.setCustomValidity(
      required && !value ? "Selecione uma opção." : ""
    );
  }, [required, value]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  function moveActive(delta: number) {
    if (visibleOptions.length === 0) return;
    setActiveIndex(
      (current) =>
        (current + delta + visibleOptions.length) % visibleOptions.length
    );
  }

  const showEmptyMessage = Boolean(query) && filtered.length === 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-14 w-full items-center justify-between gap-3 rounded-2xl border border-stone-300 bg-white px-4 text-left text-base text-stone-900 outline-none ring-brand-light focus:border-brand-light focus:ring-2 disabled:bg-stone-100 disabled:text-stone-400"
      >
        <span className={selected ? "truncate" : "truncate text-stone-400"}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          className={`h-5 w-5 shrink-0 text-stone-500 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            d="M6 8l4 4 4-4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute top-full left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_16px_40px_rgba(28,25,23,0.14)]">
          <div className="border-b border-stone-100 bg-white p-2">
            <label htmlFor={searchId} className="sr-only">
              {searchPlaceholder}
            </label>
            <div className="flex h-11 items-center gap-2 rounded-xl bg-stone-50 px-3 ring-1 ring-stone-200 focus-within:bg-white focus-within:ring-brand-light">
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4 shrink-0 text-stone-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="M13 13.5 16.5 17" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                id={searchId}
                type="text"
                inputMode="search"
                value={query}
                placeholder={searchPlaceholder}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveActive(1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveActive(-1);
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    const option = visibleOptions[activeIndex];
                    if (option) choose(option.value);
                  }
                }}
                className="h-full w-full bg-transparent text-base text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label={placeholder}
            className="max-h-60 overflow-y-auto overscroll-contain bg-white py-1"
          >
            {showEmptyMessage ? (
              <li className="px-4 py-2 text-sm text-stone-500">{emptyMessage}</li>
            ) : null}
            {visibleOptions.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              const isFallback = option.value === fallbackOption?.value;

              return (
                <li key={option.value} role="presentation">
                  {isFallback && filtered.length > 0 ? (
                    <div className="mx-3 my-1 border-t border-stone-100" />
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(option.value)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${
                      isActive ? "bg-brand-bg" : "bg-white"
                    }`}
                  >
                    <span>
                      <span className="block text-base font-semibold text-stone-900">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="mt-0.5 block text-sm text-stone-500">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <svg
                        viewBox="0 0 20 20"
                        className="h-5 w-5 shrink-0 text-brand-dark"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 10.5 8.5 14 15 6.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <input type="hidden" name={name} value={value} />
      {required ? (
        <input
          ref={validityRef}
          value={value}
          required
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
      ) : null}
    </div>
  );
}
