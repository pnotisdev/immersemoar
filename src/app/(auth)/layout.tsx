import Link from "next/link";
import { Suspense } from "react";
import { AuthVisual } from "@/components/auth/auth-visual";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <Link href="/" className="mb-8 text-2xl font-semibold tracking-tight">
          immerse<span className="text-muted-foreground">moar</span>
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
      {/* The panel reads live community numbers; the form must never wait on them. */}
      <Suspense fallback={<div className="hidden bg-black lg:block" />}>
        <AuthVisual />
      </Suspense>
    </div>
  );
}
