import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Gate every page behind Supabase Auth; only ADMIN_EMAIL gets in (v1 has no client-facing UI). */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  if (req.nextUrl.pathname.startsWith("/login")) return res;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const admin = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!user || !admin || user.email?.toLowerCase() !== admin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
