import { useEffect, useMemo, useState } from "react";
import {
  filterLanguagePickerItems,
  getLanguagePickerItem,
  type LanguagePickerItem,
} from "../lib/languagePicker";
import { SheetHeader } from "./ui/SheetHeader";
import "../home/home.css";

function pickerCopy(lang: string) {
  const el = lang === "el";
  return {
    searchPlaceholder: el ? "Αναζήτηση γλώσσας..." : "Search language...",
    selectLabel: el ? "Επιλογή" : "Select",
    emptyLabel: el ? "Δεν βρέθηκε γλώσσα" : "No language found",
    closeLabel: el ? "Πίσω" : "Back",
  };
}

function LanguageRow({
  item,
  selected,
  onSelect,
}: {
  item: LanguagePickerItem;
  selected: boolean;
  onSelect: (code: string) => void;
}) {
  return (
    <button
      type="button"
      className={`lang-row${selected ? " is-selected" : ""}`}
      onClick={() => onSelect(item.code)}
      aria-pressed={selected}
      aria-label={`${item.displayCode} ${item.name}`}
    >
      <span className="lang-row__code">{item.displayCode}</span>
      <span className="lang-row__name">{item.name}</span>
      <span className="lang-row__radio" aria-hidden="true">
        {selected ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.2 6.2l2.4 2.4 5.2-5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}

export function LanguageList({
  currentLang,
  onSelect,
  query = "",
  emptyLabel,
}: {
  currentLang: string;
  onSelect: (code: string) => void;
  query?: string;
  emptyLabel?: string;
}) {
  const items = useMemo(() => filterLanguagePickerItems(query), [query]);
  if (items.length === 0) {
    return <div className="lang-list-empty">{emptyLabel || "—"}</div>;
  }
  return (
    <div className="lang-list" role="listbox" aria-label="Languages">
      {items.map((item) => (
        <LanguageRow
          key={item.code}
          item={item}
          selected={item.code === currentLang}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function LanguageFlagOverlay({
  open,
  title,
  currentLang,
  onClose,
  onSelect,
  raised = false,
  searchPlaceholder,
  selectLabel,
  emptyLabel,
  closeLabel,
}: {
  open: boolean;
  title: string;
  currentLang: string;
  onClose: () => void;
  onSelect: (code: string) => void;
  raised?: boolean;
  searchPlaceholder?: string;
  selectLabel?: string;
  emptyLabel?: string;
  closeLabel?: string;
}) {
  const copy = pickerCopy(currentLang);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(currentLang);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPending(currentLang);
  }, [open, currentLang]);

  const filtered = useMemo(() => filterLanguagePickerItems(query), [query]);

  const confirm = () => {
    onSelect(pending);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className={`lang-overlay open${raised ? " lang-overlay--raised" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
        <div className="lang-box lang-box--list" role="dialog" aria-modal="true" aria-label={title}>
          <SheetHeader
            title={
              <>
                <span className="lang-box-title__icon" aria-hidden="true">🌐</span>
                {title.replace(/^🌐\s*/, "")}
              </>
            }
            onBack={onClose}
            backLabel={closeLabel || copy.closeLabel}
            compact
          />
        <label className="lang-search">
          <span className="lang-search__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder || copy.searchPlaceholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length === 1) {
                setPending(filtered[0].code);
                onSelect(filtered[0].code);
                onClose();
              }
            }}
          />
        </label>
        <LanguageList
          currentLang={pending}
          onSelect={setPending}
          query={query}
          emptyLabel={emptyLabel || copy.emptyLabel}
        />
        <div className="lang-picker-foot">
          <button type="button" className="lang-picker-confirm" onClick={confirm}>
            {selectLabel || copy.selectLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LanguageTriggerCode({ code }: { code: string }) {
  const item = getLanguagePickerItem(code);
  return <span className="lang-trigger-code">{item.displayCode}</span>;
}
