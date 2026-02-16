import { useSelector } from "@xstate/react";
import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { bookingActor } from "../machines/booking.actor.js";
import {
  type BookingContext,
  type BookingStateValue,
  stateToRoute,
} from "../machines/booking.machine.js";

export const useBookingMachine = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Observer l'acteur global
  const snapshot = useSelector(bookingActor, (s) => s);
  const send = (event: Parameters<typeof bookingActor.send>[0]) =>
    bookingActor.send(event);

  const snapshotValue = snapshot.value as BookingStateValue;
  const context = snapshot.context as BookingContext;

  // --- routing sync ---
  useEffect(() => {
    // We only enforce strict route sync for the linear booking flow states.
    // idle, searching, and error states are allowed to exist on any page
    // (Home or Results) to support deep linking and "Search Again" functionality.
    if (
      snapshotValue === "idle" ||
      snapshotValue === "searching" ||
      snapshotValue === "error"
    ) {
      return;
    }

    const expectedPath = stateToRoute(snapshotValue, context);
    if (location.pathname !== expectedPath) {
      void navigate(expectedPath, { replace: true });
    }
  }, [snapshotValue, context, location.pathname, navigate]);

  /** Helper to check current state value */
  const is = useCallback(
    (val: BookingStateValue) => snapshot.matches(val),
    [snapshot],
  );

  return {
    state: snapshotValue,
    context,
    send,
    isLoading: snapshot.hasTag("loading"),
    is,
    tags: snapshot.tags,
    actorRef: bookingActor,
  } as const;
};
