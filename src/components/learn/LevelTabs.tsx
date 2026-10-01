import { Button } from "@/components/ui/button";
import { LEVELS, type Level } from "@/lib/learn-queries";

export function LevelTabs({
  value,
  onChange,
}: {
  value: Level;
  onChange: (level: Level) => void;
}) {
  return (
    <div role="tablist" aria-label="Pilih level JLPT" className="flex flex-wrap gap-2">
      {LEVELS.map((level) => (
        <Button
          key={level}
          role="tab"
          aria-selected={value === level}
          size="sm"
          variant={value === level ? "default" : "outline"}
          onClick={() => onChange(level)}
        >
          {level}
        </Button>
      ))}
    </div>
  );
}
