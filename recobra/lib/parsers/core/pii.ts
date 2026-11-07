import { createHmac } from "node:crypto";

/**
 * Pseudonymise a customer identifier. Per-client salt means hashes can't be correlated
 * across clients, but repeat-claim detection still works inside one client.
 */
export function hashCustomer(salt: string, rawCustomerId: string): string {
  return createHmac("sha256", salt).update(rawCustomerId.trim().toLowerCase()).digest("hex").slice(0, 24);
}
