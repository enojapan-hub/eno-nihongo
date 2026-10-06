import { BadgeCheck, GraduationCap, Gem, ShieldCheck } from "lucide-react";
import { BADGE_META, badgeKinds, useSocialIdentity } from "@/lib/social/social-badges";
import { cn } from "@/lib/utils";

/**
 * Satu-satunya tempat badge sosial dirender. Status berasal dari server (RPC social_badges),
 * bukan dari username/nama. `size="md"` dipakai di Profile Card, `sm` di daftar/chat.
 */
export function IdentityBadges({
  userId,
  size = "sm",
  className,
}: {
  userId: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const identity = useSocialIdentity(userId);
  const kinds = identity.loaded ? badgeKinds(identity.badges) : [];
  if (kinds.length === 0) return null;
  const icon = size === "md" ? "size-[18px]" : "size-3.5";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 align-middle", className)}>
      {kinds.map((k) => {
        const { label, text } = BADGE_META[k];
        if (k === "sensei")
          return (
            <span
              key={k}
              role="img"
              aria-label={label}
              title={label}
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full bg-emerald-600/10 font-bold leading-none text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
                size === "md" ? "px-2 py-1 text-[11px]" : "px-1.5 py-0.5 text-[9px]",
              )}
            >
              <GraduationCap aria-hidden className={size === "md" ? "size-3.5" : "size-3"} />
              {text}
            </span>
          );
        if (k === "free")
          return (
            <span
              key={k}
              role="img"
              aria-label={label}
              title={label}
              className={cn(
                "inline-flex items-center rounded-full bg-muted font-bold leading-none tracking-wide text-muted-foreground",
                size === "md" ? "px-2 py-1 text-[10px]" : "px-1.5 py-0.5 text-[8px]",
              )}
            >
              {text}
            </span>
          );
        const Icon = k === "verified" ? BadgeCheck : k === "admin" ? ShieldCheck : Gem;
        return (
          <span key={k} role="img" aria-label={label} title={label} className="inline-flex">
            <Icon
              aria-hidden
              className={cn(
                icon,
                k === "verified"
                  ? "fill-sky-500/15 text-sky-600 dark:text-sky-400"
                  : k === "admin"
                    ? "fill-red-500/15 text-red-600 dark:text-red-400"
                    : "fill-yellow-400/40 text-yellow-500 dark:text-yellow-400",
              )}
            />
          </span>
        );
      })}
    </span>
  );
}
