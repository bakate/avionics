import { HttpApi } from "@effect/platform";
import { BookingGroup } from "./booking/api.js";
import { HealthGroup } from "./health/api.js";
import { InventoryGroup } from "./inventory/api.js";
import { MetaGroup } from "./meta/api.js";
import { WebhookGroup } from "./webhook/api.js";

export class Api extends HttpApi.make("Api")
  .add(BookingGroup)
  .add(InventoryGroup)
  .add(HealthGroup)
  .add(MetaGroup)
  .add(WebhookGroup)
  .prefix("/api") {}
