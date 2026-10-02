import { useBlocker } from "@tanstack/react-router";
import type { MutableRefObject } from "react";

export const formatExamTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Blocks in-app route changes / back / reload while the exam is active (until `allowLeave` is set). */
export function useExamLeaveGuard(active: boolean, allowLeave: MutableRefObject<boolean>) {
  return useBlocker({
    shouldBlockFn: () => !allowLeave.current,
    enableBeforeUnload: () => active && !allowLeave.current,
    disabled: !active,
    withResolver: true,
  });
}
