import { faker } from "@faker-js/faker";

/**
 * Transforms an OpenAPI spec to include dynamic examples for the booking simulation.
 * This is useful for tools like Scalar that don't natively support {Postman,Insomnia}-style placeholders.
 */
export function transformSpec(spec: any): any {
  const bookingExample =
    spec.paths?.["/api/bookings"]?.post?.requestBody?.content?.[
      "application/json"
    ]?.examples?.standard;

  if (bookingExample && typeof bookingExample === "object") {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const seatRow = faker.number.int({ min: 1, max: 30 });
    const seatLetter = faker.helpers.arrayElement([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);

    const type = faker.helpers.arrayElement([
      "INFANT",
      "CHILD",
      "YOUNG_ADULT",
      "ADULT",
      "SENIOR",
    ] as const);

    const ageRange = {
      INFANT: { min: 0, max: 2 },
      CHILD: { min: 3, max: 12 },
      YOUNG_ADULT: { min: 13, max: 24 },
      ADULT: { min: 25, max: 64 },
      SENIOR: { min: 65, max: 95 },
    }[type];

    bookingExample.value = {
      segments: [
        {
          flightId: "CDG-DSS-d161s0",
          cabinClass: "ECONOMY",
          seatNumber: `${seatRow}${seatLetter}`,
        },
      ],
      passengers: [
        {
          id: crypto.randomUUID(),
          firstName,
          lastName,
          email: faker.internet.email({ firstName, lastName }).toLowerCase(),
          dateOfBirth: faker.date
            .birthdate({ min: ageRange.min, max: ageRange.max, mode: "age" })
            .toISOString(),
          gender: faker.helpers.arrayElement(["MALE", "FEMALE"]),
          type,
        },
      ],
      successUrl: "https://avionics-url.com/success",
      cancelUrl: "https://avionics-url.com/cancel",
      simulate: true,
    };
  }

  return spec;
}
