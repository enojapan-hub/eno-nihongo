import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/kanji/$id")({
  component: LegacyKanjiDetailRedirect,
});

function LegacyKanjiDetailRedirect() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/kanji", search: { id }, replace: true });
  }, [id, navigate]);
  return null;
}
