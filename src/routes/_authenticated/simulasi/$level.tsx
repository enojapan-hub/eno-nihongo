import { createFileRoute, redirect } from "@tanstack/react-router";

// Former client-scored full simulation runner. Full simulations are graded by the server in
// /simulasi-penuh/$level, so old links and bookmarks are sent there.
export const Route = createFileRoute("/_authenticated/simulasi/$level")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/simulasi-penuh/$level",
      params: { level: params.level },
      replace: true,
    });
  },
});
