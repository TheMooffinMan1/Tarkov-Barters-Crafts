import { GAME_MODES } from "@compute/index.mjs";

type Props = {
  mode: string;
  onChange: (mode: string) => void;
};

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="segmented" role="tablist" aria-label="Game mode">
      {GAME_MODES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="tab"
          aria-selected={mode === entry.id}
          className={mode === entry.id ? "active" : ""}
          onClick={() => onChange(entry.id)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
