import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: {name:string;value:string;options:CookieOptions}[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) return response;

  const protectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/team") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/settings");

  if (protectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  if (!user) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,approved,is_active,rejected_at")
    .eq("id", user.id)
    .maybeSingle();

  let redirectPath: string | null = null;
  if (!profile || profile.rejected_at) {
    if (pathname !== "/account-rejected") redirectPath = "/account-rejected";
  } else if (!profile.is_active) {
    if (pathname !== "/account-disabled") redirectPath = "/account-disabled";
  } else if (!profile.approved) {
    if (pathname !== "/pending-approval") redirectPath = "/pending-approval";
  } else if (["/sign-in", "/sign-up", "/pending-approval", "/account-rejected", "/account-disabled"].includes(pathname)) {
    redirectPath = profile.role === "guest" ? "/clients" : "/dashboard";
  } else if (pathname.startsWith("/users") && profile.role !== "admin") {
    redirectPath = "/dashboard";
  } else if (profile.role === "guest" && (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/team") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/users") ||
    pathname === "/projects/new" ||
    pathname.startsWith("/projects/new/")
  )) {
    redirectPath = "/clients";
  }

  if (redirectPath) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
