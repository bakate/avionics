import { createActor } from "xstate";
import { bookingMachine } from "./booking.machine";
import { loadBookingState, saveBookingState } from "./booking.persistence";

/**
 * Global Singleton Actor for the booking flow.
 * Persistence enabled via sessionStorage.
 */
const persistedState = loadBookingState();

export const bookingActor = createActor(bookingMachine, {
  snapshot: persistedState,
}).start();

// Persist on every state change
bookingActor.subscribe(() => {
  saveBookingState(bookingActor.getPersistedSnapshot());
});
