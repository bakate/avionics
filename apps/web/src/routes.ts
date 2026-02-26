// Typed route definitions — single source of truth for all navigation paths.
// All navigation (links, redirects, programmatic) MUST use buildRoute helpers.

export const ROUTES = {
  home: "/",
  outbound: "/outbound",
  return: "/return",
  passengers: "/passengers",
  payment: "/payment",
  confirmation: "/confirmation/:pnr",
  success: "/success",
  cancel: "/cancel",
  stressTest: "/stress-test",
  bookingDetails: "/booking/:id",
} as const;

export type RouteName = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteName];

export const buildRoute = {
  home: () => ROUTES.home,
  outbound: () => ROUTES.outbound,
  return: () => ROUTES.return,
  passengers: () => ROUTES.passengers,
  payment: () => ROUTES.payment,
  confirmation: (pnr: string) =>
    `/confirmation/${encodeURIComponent(pnr)}` as const,
  success: (pnr?: string) =>
    pnr ? `/success?pnr=${encodeURIComponent(pnr)}` : "/success",
  cancel: () => ROUTES.cancel,
  stressTest: () => ROUTES.stressTest,
  bookingDetails: (id: string) => `/booking/${encodeURIComponent(id)}` as const,
} as const;
