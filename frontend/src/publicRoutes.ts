/** Paths that do not require authentication. */
export const PUBLIC_ROUTES = ["/", "/home"] as const;

export type PublicRoute = (typeof PUBLIC_ROUTES)[number];

export function isPublicRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (PUBLIC_ROUTES as readonly string[]).includes(path);
}

export const APP_ROUTE = "/app";
