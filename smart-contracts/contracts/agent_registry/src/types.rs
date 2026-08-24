use soroban_sdk::{contracttype, Address, BytesN, Symbol};

/// On-chain capability attestation with cryptographic signature proof.
///
/// An agent owner signs a message claiming a specific capability, and the
/// signature is verified on-chain against the provided ed25519 public key.
/// Attestations expire after a configurable TTL and can be revoked by the owner.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attestation {
    /// The agent this attestation is for.
    pub agent_id: Symbol,
    /// The capability being attested.
    pub capability: Symbol,
    /// Soroban address of the signer (used for revocation auth).
    pub signer: Address,
    /// Ed25519 public key of the signer (used for signature verification).
    pub signer_pubkey: BytesN<32>,
    /// Ed25519 signature over `(agent_id, capability)`.
    pub signature: BytesN<64>,
    /// Ledger timestamp when the attestation was created.
    pub created_at: u64,
    /// Ledger timestamp when the attestation expires.
    pub expires_at: u64,
    /// Whether the attestation has been revoked.
    pub revoked: bool,
}
