// import { createBrowserInspector } from "@statelyai/inspect";
import { createActor } from "xstate";
import { bookingMachine } from "./booking.machine";
import { loadBookingState, saveBookingState } from "./booking.persistence";

/**
 * Stately Inspector setup (for development only).
 * Allows visualizing machine transitions in real-time.
 */
// let inspector: any;

// if (typeof window !== "undefined" && import.meta.env.DEV) {
//   console.log("[Inspector] Initializing Stately Inspector...");
//   inspector = createBrowserInspector({
//     autoStart: true,
//   });
// }

/**
 * Global Singleton Actor for the booking flow.
 * Persistence enabled via sessionStorage.
 */
const persistedState = loadBookingState();

export const bookingActor = createActor(bookingMachine, {
  snapshot: persistedState,
  //...(inspector ? { inspect: inspector.inspect } : {}),
}).start();

// Persist on every state change
bookingActor.subscribe(() => {
  saveBookingState(bookingActor.getPersistedSnapshot());
});
