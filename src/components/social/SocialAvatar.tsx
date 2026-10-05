import { UserRound } from "lucide-react";
import { avatarFor } from "@/lib/social/social-avatar";
import { cn } from "@/lib/utils";

/** Avatar dari `avatar_id` (tanpa upload). Id yang belum dikenal memakai avatar default. */
export function SocialAvatar({
  avatarId,
  size = 32,
  className,
}: {
  avatarId: number | null | undefined;
  size?: number;
  className?: string;
}) {
  const a = avatarFor(avatarId);
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn("grid shrink-0 place-items-center rounded-full", a.tone, className)}
    >
      <UserRound style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}
