/** A lock was not acquired; this attempt never entered the protected callback. */
export class OperationBusyError extends Error {
  constructor() {
    super(
      "Operace už právě probíhá. Vyčkejte prosím chvíli a zkuste to znovu.",
    );
    this.name = "OperationBusyError";
  }
}
