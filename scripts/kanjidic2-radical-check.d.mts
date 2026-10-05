export const OFFICIAL_URL: string;
export function parseKanjidic2(xml: string): {
  header: { databaseVersion: string | null; dateOfCreation: string | null };
  radicals: Map<string, number>;
};
export function diffRadicals(
  mine: Record<string, number>,
  official: Map<string, number>,
): { changed: Array<{ ch: string; from: number; to: number }>; missing: string[] };
