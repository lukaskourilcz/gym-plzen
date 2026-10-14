"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog } from "@/components/admin/dialog";
import { Button } from "@/components/ui/button";
import { PricingPeriodForm } from "./pricing-period-form";

export function PricingPeriodCreate() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Přidat období
      </Button>
      {open ? (
        <AdminDialog
          title="Přidat cenové období"
          description="Datum „do“ platí včetně celého zvoleného dne v časovém pásmu Praha."
          onClose={() => setOpen(false)}
        >
          <PricingPeriodForm
            onSaved={() => {
              setOpen(false);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        </AdminDialog>
      ) : null}
    </>
  );
}
