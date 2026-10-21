"use client";
import { createContext, useContext, type ReactNode } from "react";
import {
  defaultPublicNotices,
  type PublicNotices,
} from "@/lib/config/public-notices";
const Notices = createContext<PublicNotices>(defaultPublicNotices());
export function PublicNoticesProvider({
  notices,
  children,
}: {
  notices: PublicNotices;
  children: ReactNode;
}) {
  return <Notices value={notices}>{children}</Notices>;
}
export function usePublicNotices() {
  return useContext(Notices);
}
