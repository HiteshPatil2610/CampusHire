import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define route matchers for each role group
const isStudentRoute = createRouteMatcher(["/student-dashboard(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin-dashboard(.*)"]);
const isSuperAdminRoute = createRouteMatcher(["/super-admin-dashboard(.*)"]);
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

interface ClerkPublicMetadata {
  role?: string;
}

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  
  // Allow auth routes (sign-in, sign-up)
  if (isAuthRoute(req)) {
    return NextResponse.next();
  }

  // Allow home page for everyone (authenticated or not)
  if (req.nextUrl.pathname === "/") {
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

  // Route protection based on role
  if (isStudentRoute(req) && role !== "STUDENT") {
    // If no role is set, allow access (for now, during setup)
    // In production, you'd redirect to a "setup profile" page
    if (!role) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isAdminRoute(req) && role !== "DEPT_ADMIN") {
    if (!role) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isSuperAdminRoute(req) && role !== "SUPER_ADMIN") {
    if (!role) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

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
