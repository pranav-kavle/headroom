import { clerkMiddleware } from "@clerk/nextjs/server";

// Auth is enforced per-route/page (resource-based checks), not here by path
// matching — see https://clerk.com/docs/guides/development/upgrading/upgrade-guides/migrate-from-create-route-matcher.
// This middleware only needs to run so `auth()`/`currentUser()` work downstream.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip)).*)",
    "/(api|trpc)(.*)",
  ],
};
