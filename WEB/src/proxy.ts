import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip all paths that are not pages: API routes, Next.js internals,
  // and files with an extension (static assets).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
