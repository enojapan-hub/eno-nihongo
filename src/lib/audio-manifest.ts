/**
 * Pemilihan audio simulasi per ujian. Identitas minimal sebuah sumber audio adalah
 * level + exam_no (+ scope/mondai). Baris lama tanpa exam_no dianggap exam 1.
 */
export function rowExamNo(row: { exam_no?: unknown }): number {
  const value = Number(row.exam_no ?? 1);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

/** Parameter `exam` manifest; kosong/tidak valid = exam 1 (perilaku lama). */
export function parseManifestExam(param: string | null | undefined): number {
  const value = Number(param ?? "1");
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

/** Hanya baris milik exam yang diminta; tidak pernah jatuh kembali ke exam lain. */
export function selectExamRows<T extends { exam_no?: unknown }>(rows: T[], examNo: number): T[] {
  return rows.filter((row) => rowExamNo(row) === examNo);
}
