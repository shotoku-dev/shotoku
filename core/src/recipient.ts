/**
 * Canonical form of a payment recipient, for comparison only. EVM addresses are
 * case-insensitive (mixed case is just a checksum), so `0xAbC…` and `0xabc…` are
 * one recipient. Anything else — a Solana address, an account ID — is
 * case-sensitive and compared exactly.
 */
export function normalizeRecipient(recipient: string): string {
  const trimmed = recipient.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}
