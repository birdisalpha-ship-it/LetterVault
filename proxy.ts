import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/", "/auth/login", "/auth/register", "/auth/error", "/api/auth"];
const institutionPaths = ["/institution"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const roles = req.auth.user?.roles ?? [];

  if (institutionPaths.some((p) => pathname.startsWith(p))) {
    if (!roles.includes("INSTITUTION_ADMIN")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
