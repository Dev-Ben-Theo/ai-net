import {
  clearRegistry,
  deregisterAgent,
  discoverAgents,
  getAgent,
  registerAgent,
} from '../src/registry/registry';

describe('Agent Registry — basic operations', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers and discovers an agent by capability', () => {
    registerAgent({
      id: 't1',
      name: 'Test',
      capability: 'research',
      priceXLM: 1,
      reputationScore: 1,
      stellarAddress: '',
    });
    const results = discoverAgents('research');
    expect(results.some((a) => a.id === 't1')).toBe(true);
  });

  it('returns empty array for unknown capability', () => {
    expect(discoverAgents('nonexistent-capability-xyz')).toEqual([]);
  });

  it('retrieves an agent by id', () => {
    registerAgent({
      id: 't2',
      name: 'Test2',
      capability: 'risk',
      priceXLM: 2,
      reputationScore: 0.8,
      stellarAddress: '',
    });
    expect(getAgent('t2')?.name).toBe('Test2');
  });

  it('deregisters an agent', () => {
    registerAgent({
      id: 't3',
      name: 'Test3',
      capability: 'coding',
      priceXLM: 3,
      reputationScore: 0.7,
      stellarAddress: '',
    });
    expect(deregisterAgent('t3')).toBe(true);
    expect(getAgent('t3')).toBeUndefined();
  });

  it('returns false when deregistering a non-existent agent', () => {
    expect(deregisterAgent('ghost')).toBe(false);
  });

  it('overwrites existing agent on re-register', () => {
    registerAgent({
      id: 't4',
      name: 'Original',
      capability: 'design',
      priceXLM: 5,
      reputationScore: 0.5,
      stellarAddress: '',
    });
    registerAgent({
      id: 't4',
      name: 'Updated',
      capability: 'design',
      priceXLM: 3,
      reputationScore: 0.9,
      stellarAddress: '',
    });
    expect(getAgent('t4')?.name).toBe('Updated');
    expect(getAgent('t4')?.priceXLM).toBe(3);
  });

  it('defaults reputationScore to 1 when not provided', () => {
    registerAgent({
      id: 't5',
      name: 'NoRep',
      capability: 'report',
      priceXLM: 1,
      reputationScore: undefined as unknown as number,
      stellarAddress: '',
    });
    expect(getAgent('t5')?.reputationScore).toBe(1);
  });
});
