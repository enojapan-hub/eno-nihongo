import { createFileRoute, redirect } from "@tanstack/react-router";

// Rute lama: foto profil kini diatur di satu editor (/edit-profil). Tautan/bookmark lama diarahkan ke sana.
export const Route = createFileRoute("/_authenticated/profil-foto")({
  beforeLoad: () => {
    throw redirect({ to: "/edit-profil", replace: true });
  },
});
