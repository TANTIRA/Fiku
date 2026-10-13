import Link from "next/link";
import { Fuku } from "@/components/fuku/fuku";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <Fuku mood="happy" size={176} sparkle />
      <div className="space-y-4">
        <h1 className="font-pixel text-5xl sm:text-6xl">Fuku</h1>
        <p className="mx-auto max-w-xl text-lg">
          Asisten keuangan pribadi yang imut. Cukup ketik{" "}
          <code className="rounded bg-gold-soft px-1.5 py-0.5 font-pixel">kopi 25rb</code> atau{" "}
          <code className="rounded bg-jade-soft px-1.5 py-0.5 font-pixel">gajian 7,5jt</code> —
          Fuku yang catat, kategorikan, dan rangkum uang masuk & keluarmu.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <Link href="/login" className="pixel-btn text-lg">
          ▶ Mulai main
        </Link>
      </div>
      <ul className="grid w-full gap-4 text-left sm:grid-cols-3">
        {[
          ["💬", "Catat lewat chat", "Bahasa sehari-hari: \"bensin 30rb, parkir 5rb kemarin\"."],
          ["🧠", "Makin pintar", "Fuku ingat kamu biasa jajan di mana & kategorinya apa."],
          ["📊", "50/30/20", "Lihat porsi kebutuhan, keinginan, dan tabungan tiap bulan."],
        ].map(([icon, title, text]) => (
          <li key={title} className="pixel-card p-4">
            <div className="text-2xl">{icon}</div>
            <h2 className="mt-2 font-pixel text-lg">{title}</h2>
            <p className="mt-1 text-sm opacity-80">{text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
