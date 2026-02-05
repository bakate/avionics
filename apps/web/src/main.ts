import { Flight } from "@workspace/domain/flight";
import { Schema } from "effect";

import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div>
    <h1>Domain Object Test: Flight</h1>
    <div class="card">
        <div id="flight-display">Loading...</div>
    </div>
  </div>
`;

// Example Usage
const exampleFlight = {
  id: "FL-101",
  flightNumber: "AF1234",
  route: {
    origin: "CDG",
    destination: "JFK",
  },
  schedule: {
    departure: new Date().toISOString(),
    arrival: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
  },
};

// Decode using the shared Schema
const decodeResult = Schema.decodeUnknownEither(Flight)(exampleFlight);

const displayEl = document.querySelector("#flight-display")!;

if (decodeResult._tag === "Right") {
  const flight = decodeResult.right;

  displayEl.innerHTML = `
      <div style="text-align: left; font-family: monospace;">
        <h3>Flight Decoded Successfully ✅</h3>
        <p><strong>Flight #:</strong> ${flight.flightNumber}</p>
        <p><strong>Route:</strong> ${flight.route.origin} ✈️ ${flight.route.destination}</p>
        <hr/>
        <pre>${JSON.stringify(flight, null, 2)}</pre>
      </div>
    `;
  console.log("Decoded Flight:", flight);
} else {
  displayEl.innerHTML = `
        <h3 style="color: red">Decoding Failed ❌</h3>
        <pre>${JSON.stringify(decodeResult.left, null, 2)}</pre>
    `;
  console.error("Decoding Failed:", decodeResult.left);
}
