//! # Data Types for Agent Registry Multi-Sig Administration
//!
//! Defines the structs and enums used for multi-signature proposals, approvals,
//! and threshold configuration.

use crate::GasConfig;
use soroban_sdk::{contracttype, Address, Symbol, Vec};

/// Admin actions that require multi-signature proposal and timelock execution.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AdminAction {
    Pause,
    Unpause,
    SetAdmin(Address),
    SlashBond(Symbol, i128),
    SetMinBond(i128),
    SetGasConfig(GasConfig),
    SetMultisigConfig(Vec<Address>, u32, u64),
}

/// Multi-signature administration configuration parameters.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MultisigConfig {
    /// List of authorized admin signer addresses.
    pub admins: Vec<Address>,
    /// Minimum required approval count (M of N).
    pub threshold: u32,
    /// Delay in seconds before an approved proposal can be executed.
    pub timelock_delay: u64,
}

/// On-chain representation of a multi-signature admin proposal.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    /// Unique proposal identifier.
    pub id: u64,
    /// Address of the admin who created the proposal.
    pub proposer: Address,
    /// Critical admin action to execute.
    pub action: AdminAction,
    /// Creation timestamp (seconds).
    pub created_at: u64,
    /// Earliest timestamp at which proposal can be executed (created_at + timelock_delay).
    pub eta: u64,
    /// Timestamp after which proposal can no longer be executed.
    pub expires_at: u64,
    /// Addresses of admins who have approved this proposal.
    pub approvals: Vec<Address>,
    /// Whether proposal has been executed.
    pub executed: bool,
    /// Whether proposal was cancelled by proposer.
    pub cancelled: bool,
}

/// Approval record for a proposal.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Approval {
    /// Proposal ID being approved.
    pub proposal_id: u64,
    /// Address of approving admin.
    pub approver: Address,
    /// Timestamp when approval was granted.
    pub timestamp: u64,
}

/// Query parameters for the agent discovery oracle.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DiscoveryQuery {
    /// The specific capability required for matching agents.
    pub required_capability: Symbol,
    /// Maximum acceptable price in stroops (0 = no maximum price restriction).
    pub max_price: i128,
    /// Minimum acceptable reputation score [0, 100].
    pub min_reputation: u32,
    /// Maximum acceptable response time / latency in milliseconds (0 = no maximum latency restriction).
    pub max_latency: u32,
}

/// Individual ranked agent result returned by the discovery oracle.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DiscoveryResult {
    /// Unique identifier of the matched agent.
    pub agent_id: Symbol,
    /// Composite match score scaled to basis points [0, 10000] (representing 0.00% to 100.00%).
    pub composite_score: u32,
    /// Service price in stroops.
    pub price_stroops: i128,
    /// Reputation score [0, 100].
    pub reputation: u32,
    /// Availability score percentage [0, 100].
    pub availability: u32,
    /// Response time / latency in milliseconds.
    pub response_time: u32,
}

/// Aggregate discovery statistics tracked across all oracle queries.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DiscoveryStats {
    /// Total count of discovery queries executed.
    pub total_queries: u64,
    /// Total number of agent matches returned across all queries.
    pub total_matches_found: u64,
    /// Number of queries served from in-memory / temporary storage cache.
    pub cache_hits: u64,
}
