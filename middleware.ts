import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define route matchers for each role group
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);
const isStudentRoute = createRouteMatcher(["/student-dashboard(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin-dashboard(.*)"]);
const isSuperAdminRoute = createRouteMatcher(["/super-admin-dashboard(.*)"]);

interface ClerkPublicMetadata {
  role?: "STUDENT" | "DEPT_ADMIN" | "SUPER_ADMIN";
}

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Require authentication for all protected routes
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Get user role from Clerk metadata
  const metadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
  const role = metadata?.role;

  // If user has no role yet, allow access (webhook might not have processed yet)
  // Server actions will handle authorization with database lookup
  if (!role) {
    // For new users without role, allow them through to complete setup
    // Server-side auth helpers will handle proper authorization
    return NextResponse.next();
  }

  // Route protection based on role
  // These are quick checks using metadata for performance
  // Server actions MUST do database lookup for actual authorization

  if (isStudentRoute(req)) {
    if (role !== "STUDENT") {
      // Wrong role - redirect to home
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (isAdminRoute(req)) {
    if (role !== "DEPT_ADMIN") {
      // Wrong role - redirect to home
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (isSuperAdminRoute(req)) {
    if (role !== "SUPER_ADMIN") {
      // Wrong role - redirect to home
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Allow access if all checks pass
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
