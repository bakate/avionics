import { faker } from "@faker-js/faker";
import { HttpResponse, http } from "msw";

export const makeHandlers = (polarBaseUrl: string) => [
  http.post(`${polarBaseUrl}/v1/checkouts`, async ({ request }) => {
    const body = (await request.json()) as { amount: number; currency: string };
    return HttpResponse.json({
      id: `ch_${faker.string.alphanumeric(10)}`,
      url: `https://sandbox.polar.sh/checkout/test`,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      status: "open",
      total_amount: body.amount,
      currency: body.currency,
    });
  }),
  http.get(`${polarBaseUrl}/v1/checkouts/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id as string,
      status: "open",
      total_amount: 10000,
      currency: "usd",
    });
  }),
];
