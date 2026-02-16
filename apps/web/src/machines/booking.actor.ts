import { createActor } from "xstate";
import { bookingMachine } from "./booking.machine";

/**
 * Global Singleton Actor for the booking flow.
 * No persistence for now (MVP simplification).
 */
export const bookingActor = createActor(bookingMachine).start();
