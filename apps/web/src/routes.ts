// Typed route definitions — single source of truth for all navigation paths.
// All navigation (links, redirects, programmatic) MUST use buildRoute helpers.

export const ROUTES = {
  home: "/",
  results: "/results",
  select: "/select/:flightId",
  passengers: "/passengers",
  payment: "/payment",
  confirmation: "/confirmation/:pnr",
} as const;

export type RouteName = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteName];

export const buildRoute = {
  home: () => ROUTES.home,
  results: () => ROUTES.results,
  select: (flightId: string) =>
    `/select/${encodeURIComponent(flightId)}` as const,
  passengers: () => ROUTES.passengers,
  payment: () => ROUTES.payment,
  confirmation: (pnr: string) =>
    `/confirmation/${encodeURIComponent(pnr)}` as const,
} as const;
