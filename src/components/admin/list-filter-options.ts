import {
  messageChannel,
  messageKind,
  messageStatus,
  reservationStatus,
} from "@/lib/db/schema/enums";
import {
  formatChannel,
  formatMessageKind,
  formatStatus,
} from "@/lib/helpers/format";
import type { AdminSelectFilter } from "./list-filters";

export const memberFilters: AdminSelectFilter[] = [
  {
    name: "role",
    label: "Role",
    options: [
      { value: "admin", label: "Správce" },
      { value: "member", label: "Člen" },
    ],
  },
];
export const reservationFilters: AdminSelectFilter[] = [
  {
    name: "status",
    label: "Stav",
    options: reservationStatus.enumValues.map((value) => ({
      value,
      label: formatStatus(value),
    })),
  },
];
export const messageFilters: AdminSelectFilter[] = [
  {
    name: "channel",
    label: "Kanál",
    options: messageChannel.enumValues.map((value) => ({
      value,
      label: formatChannel(value),
    })),
  },
  {
    name: "status",
    label: "Stav",
    options: messageStatus.enumValues.map((value) => ({
      value,
      label: formatStatus(value),
    })),
  },
  {
    name: "kind",
    label: "Typ",
    options: messageKind.enumValues.map((value) => ({
      value,
      label: formatMessageKind(value),
    })),
  },
];
