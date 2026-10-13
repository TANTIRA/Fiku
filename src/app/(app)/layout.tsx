import Link from "next/link";
import { Suspense } from "react";
import { Fuku } from "@/components/fuku/fuku";
import { requireSession } from "@/lib/finance";
import { signOut } from "../login/actions";
import { NavLinks } from "./nav-links";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b-[3px] border-ink bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Fuku mood="happy" size={36} animate={false} />
            <span className="font-pixel text-xl">Fuku</span>
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-3">
            <Suspense fallback={null}>
              <UserEmail />
            </Suspense>
            <form action={signOut}>
              <button className="pixel-btn pixel-btn-ghost px-3 py-1 text-sm">Keluar</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:pb-6">{children}</main>
    </div>
  );
}

async function UserEmail() {
  const { email } = await requireSession();
  return <span className="hidden text-sm opacity-70 md:inline">{email}</span>;
}
