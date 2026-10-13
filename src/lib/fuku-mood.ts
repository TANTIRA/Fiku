import type { Mood } from "@/components/fuku/sprite";
import { formatCompact } from "@/lib/money";
import type { MonthlySummary } from "@/lib/types";

/** What Fuku feels and says about the month. */
export function fukuReaction(s: MonthlySummary): { mood: Mood; sparkle: boolean; message: string } {
  if (s.income === 0 && s.expense === 0) {
    return {
      mood: "sleepy",
      sparkle: false,
      message: "Zzz… belum ada catatan bulan ini. Bangunin aku dengan ketik \"makan siang 25rb\" di Asisten!",
    };
  }
  if (s.income === 0) {
    return {
      mood: "thinking",
      sparkle: false,
      message: `Sudah keluar ${formatCompact(s.expense)}, tapi pemasukan belum dicatat. Gajian sudah masuk belum?`,
    };
  }
  const ratio = s.expense / s.income;
  const wantShare = s.expense ? s.byNecessity.keinginan / s.income : 0;
  const saved = s.byNecessity.tabungan + Math.max(s.balance, 0);

  if (ratio > 1) {
    return {
      mood: "worried",
      sparkle: false,
      message: `Waduh! Pengeluaran ${formatCompact(s.expense - s.income)} lebih besar dari pemasukan. Yuk rem dulu jajannya 🥺`,
    };
  }
  if (wantShare > 0.3) {
    return {
      mood: "thinking",
      sparkle: false,
      message: `Belanja "keinginan" sudah ${Math.round(wantShare * 100)}% dari pemasukan (idealnya ≤30%). Hmm…`,
    };
  }
  if (saved / s.income >= 0.2) {
    return {
      mood: "happy",
      sparkle: true,
      message: `Hebat! Kamu menyisihkan ${Math.round((saved / s.income) * 100)}% bulan ini. Benih tabunganku tumbuh! 🌱`,
    };
  }
  return {
    mood: "idle",
    sparkle: false,
    message: `Sisa ${formatCompact(s.balance)} bulan ini. Coba sisihkan 20% untuk tabungan ya!`,
  };
}
