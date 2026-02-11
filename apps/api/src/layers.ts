import { BookingService } from "@workspace/application/booking.service";
import { CancellationService } from "@workspace/application/cancellation.service";
import { InventoryService } from "@workspace/application/inventory.service";
import { Layer } from "effect";

/**
 * Main Application Layer combining all domain services.
 * InventoryService must be provided to satisfy requirements of Booking and Cancellation.
 */
export const AppLayer = Layer.merge(
  BookingService.Live,
  CancellationService.Live,
).pipe(Layer.provideMerge(InventoryService.Live));
