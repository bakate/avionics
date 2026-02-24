import { useSelector } from "@xstate/react";
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { bookingActor } from "@/features/booking/machines/booking.actor";
import {
  type BookingStateValue,
  stateToRoute,
} from "@/features/booking/machines/booking.machine";

export const useBookingMachine = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Observer l'acteur global
  const snapshot = useSelector(bookingActor, (s) => s);
  const send = (event: Parameters<typeof bookingActor.send>[0]) =>
    bookingActor.send(event);

  const snapshotValue = snapshot.value;
  const context = snapshot.context;

  const lastStateValue = useRef<BookingStateValue>(snapshotValue);

  // --- routing sync ---
  useEffect(() => {
    const expectedPath = stateToRoute(snapshotValue, context);
    const isHome = location.pathname === "/";
    const stateChanged = lastStateValue.current !== snapshotValue;

    // 1. If the machine state value changed (e.g. search finished), ADVANCE the route
    if (stateChanged) {
      lastStateValue.current = snapshotValue;

      // Ignore home-bound states for auto-navigation
      if (
        snapshotValue !== "idle" &&
        snapshotValue !== "searching" &&
        snapshotValue !== "error" &&
        location.pathname !== expectedPath
      ) {
        void navigate(expectedPath, { replace: true });
        return;
      }
    }

    // 2. If the user manualy navigated back to home while in a flow, RESET
    if (
      isHome &&
      snapshotValue !== "idle" &&
      snapshotValue !== "searching" &&
      snapshotValue !== "error"
    ) {
      send({ type: "RESET" });
    }

    // 3. If on success page, ensure machine is in confirmed state
    if (
      location.pathname.startsWith("/success") &&
      snapshotValue !== "confirmed"
    ) {
      send({ type: "COMPLETE" });
    }
  }, [snapshotValue, context, location.pathname, navigate, send]);

  /** Helper to check current state value */
  const is = useCallback(
    (val: BookingStateValue) => snapshot.matches(val),
    [snapshot],
  );

  /** Manual reset helper */
  const reset = useCallback(() => send({ type: "RESET" }), [send]);

  return {
    state: snapshotValue,
    context,
    send,
    reset,
    isLoading: snapshot.hasTag("loading"),
    is,
    tags: snapshot.tags,
    actorRef: bookingActor,
  } as const;
};
