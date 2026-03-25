import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/", "/auth/login", "/auth/register", "/auth/error", "/api/auth"];
// Paths that require INSTITUTION_ADMIN role
const institutionAdminPaths = ["/institution"];
// Institution paths accessible to any authenticated user (e.g. to set up a first institution)
const institutionOpenPaths = ["/institution/new"];

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

  const isInstitutionAdminPath = institutionAdminPaths.some((p) => pathname.startsWith(p));
  const isInstitutionOpenPath = institutionOpenPaths.some((p) => pathname.startsWith(p));

  if (isInstitutionAdminPath && !isInstitutionOpenPath) {
    if (!roles.includes("INSTITUTION_ADMIN")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
