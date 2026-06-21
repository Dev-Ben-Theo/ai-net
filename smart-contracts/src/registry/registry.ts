/**
 * In-memory Agent Registry.
 *
 * Provides register / discover / lookup / deregister helpers used by all
 * agents on startup. The on-chain Soroban version will replace this later
 * (see Issue #1) while keeping the same public API.
 */

export interface Agent {
  id: string;
  name: string;
  capability: string;
  priceXLM: number;
  stellarAddress: string;
  endpoint?: string;
}

// Module-level in-memory store — isolated per test via clearRegistry()
const agents = new Map<string, Agent>();

/**
 * Register an agent in the registry.
 * Overwrites any existing record with the same id.
 * Returns the registered agent for convenience.
 */
export function registerAgent(agent: Agent): Agent {
  agents.set(agent.id, agent);
  return agent;
}

/**
 * Discover all agents that match a given capability.
 * Returns an empty array when none are found.
 */
export function discoverAgents(capability: string): Agent[] {
  return Array.from(agents.values()).filter(
    (agent) => agent.capability === capability,
  );
}

/**
 * Retrieve a single agent by its unique id.
 * Returns undefined when the agent is not found.
 */
export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

/**
 * Remove an agent from the registry.
 * Returns true if the agent existed and was removed.
 */
export function deregisterAgent(id: string): boolean {
  return agents.delete(id);
}

/**
 * Clear all agents from the registry.
 * Exposed for test isolation — do NOT call in production code.
 */
export function clearRegistry(): void {
  agents.clear();
}
