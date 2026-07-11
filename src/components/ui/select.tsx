"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, Check } from "lucide-react";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string; keywords?: string }[];
  placeholder?: string;
  /** Força modo busca mesmo com poucas opções */
  searchable?: boolean;
}

/** Acima deste nº de opções o Select vira combobox pesquisável automaticamente */
const SEARCH_THRESHOLD = 8;

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, error, options, placeholder, id, searchable, ...props },
    ref
  ) => {
    const selectId = id || label?.toLowerCase().replace(/\s/g, "-");
    const isSearch = searchable || options.length > SEARCH_THRESHOLD;

    // ── Combobox state (só usado no modo busca) ────────────────────────────
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    // Pausa antes de atualizar as sugestões, para dar tempo de leitura
    const [debouncedQuery, setDebouncedQuery] = React.useState("");
    const [highlight, setHighlight] = React.useState(0);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const value = (props.value ?? "") as string;
    const selected = options.find((o) => o.value === value);

    React.useEffect(() => {
      if (!query.trim()) {
        setDebouncedQuery("");
        return;
      }
      const t = setTimeout(() => setDebouncedQuery(query), 500);
      return () => clearTimeout(t);
    }, [query]);

    const filtered = React.useMemo(() => {
      if (!debouncedQuery.trim()) return options;
      const q = normalize(debouncedQuery);
      return options.filter((o) =>
        normalize(o.label + " " + (o.keywords || "")).includes(q)
      );
    }, [options, debouncedQuery]);

    React.useEffect(() => {
      if (!open) return;
      function onClickOutside(e: MouseEvent) {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          setOpen(false);
          setQuery("");
        }
      }
      document.addEventListener("mousedown", onClickOutside);
      return () => document.removeEventListener("mousedown", onClickOutside);
    }, [open]);

    React.useEffect(() => {
      if (open) {
        setHighlight(0);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }, [open, debouncedQuery]);

    function emit(newValue: string) {
      props.onChange?.({
        target: { value: newValue },
      } as React.ChangeEvent<HTMLSelectElement>);
      setOpen(false);
      setQuery("");
    }

    function scrollTo(index: number) {
      const el = listRef.current?.children[index] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }

    function onKeyDown(e: React.KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => {
          const next = Math.min(h + 1, filtered.length - 1);
          scrollTo(next);
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => {
          const next = Math.max(h - 1, 0);
          scrollTo(next);
          return next;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[highlight]) emit(filtered[highlight].value);
      } else if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }

    if (isSearch) {
      return (
        <div className="flex flex-col gap-1 w-full" ref={rootRef}>
          {label && (
            <label className="text-sm font-medium text-slate-700">{label}</label>
          )}
          <div className="relative">
            <button
              type="button"
              disabled={props.disabled}
              onClick={() => setOpen((o) => !o)}
              className={cn(
                "flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
                error && "border-red-500",
                className
              )}
            >
              <span
                className={cn(
                  "truncate text-left",
                  !selected && "text-slate-400"
                )}
              >
                {selected?.label || placeholder || "Selecione"}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
            </button>

            {open && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Pesquisar..."
                    className="w-full text-sm focus:outline-none placeholder:text-slate-400"
                  />
                </div>
                <div ref={listRef} className="max-h-64 overflow-y-auto py-1.5">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-slate-400 text-center">
                      Nenhum resultado encontrado
                    </p>
                  ) : (
                    filtered.map((opt, i) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => emit(opt.value)}
                        onMouseEnter={() => setHighlight(i)}
                        className={cn(
                          "flex w-full items-center justify-between px-3.5 py-3 my-0.5 text-sm leading-relaxed text-left transition-colors",
                          i === highlight
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-700"
                        )}
                      >
                        <span className="truncate">{opt.label}</span>
                        {opt.value === value && (
                          <Check className="h-4 w-4 shrink-0 ml-2" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );
    }

    // ── Select nativo (listas pequenas) ─────────────────────────────────────
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-slate-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            className={cn(
              "flex h-9 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500 focus-visible:ring-red-500",
              className
            )}
            ref={ref}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
