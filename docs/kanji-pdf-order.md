# Canonical JLPT Kanji Order

Source of truth: `Kanji Tunggal Lengkap N1-N5.pdf`.

The live Supabase `kanji` table is reconciled to this order.

| Level | Count |
| --- | ---: |
| N5 | 80 |
| N4 | 167 |
| N3 | 370 |
| N2 | 368 |
| N1 | 1,235 |
| Total | 2,220 |

Each published record has a locked `sort_order`, Indonesian meaning, and at least one on-yomi or kun-yomi reading.
