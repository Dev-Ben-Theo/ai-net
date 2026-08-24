use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AttestationError {
    /// The provided ed25519 signature does not match the message and public key.
    InvalidSignature = 30,
    /// The attestation has passed its expiry timestamp.
    AttestationExpired = 31,
    /// The attestation was previously revoked by its owner.
    AttestationRevoked = 32,
}
