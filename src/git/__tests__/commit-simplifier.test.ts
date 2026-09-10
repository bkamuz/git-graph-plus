import { describe, it, expect } from 'vitest';
import { simplifyCommits } from '../commit-simplifier';
import type { Commit, Ref } from '../types';

function makeCommit(hash: string, parents: string[] = [], refs: Ref[] = []): Commit {
  return {
    hash,
    abbreviatedHash: hash.substring(0, 7),
    author: { name: 'Test', email: 'test@test.com', date: '2024-01-01' },
    committer: { name: 'Test', email: 'test@test.com', date: '2024-01-01' },
    subject: `Commit ${hash}`,
    body: '',
    parents,
    refs,
  };
}

describe('simplifyCommits', () => {
  it('returns empty and tiny lists unchanged', () => {
    expect(simplifyCommits([])).toEqual([]);
    expect(simplifyCommits([makeCommit('a')])).toEqual([makeCommit('a')]);
  });

  it('collapses a linear chain to boundaries plus ref tips', () => {
    const commits = [
      makeCommit('c3', ['c2'], [{ type: 'head', name: 'HEAD' }]),
      makeCommit('c2', ['c1']),
      makeCommit('c1', []),
    ];

    const simplified = simplifyCommits(commits);
    expect(simplified.map(c => c.hash)).toEqual(['c3', 'c1']);
    expect(simplified[0].parents).toEqual(['c1']);
  });

  it('keeps merge commits and fork points', () => {
    const commits = [
      makeCommit('merge', ['feature', 'main'], [{ type: 'branch', name: 'main' }]),
      makeCommit('feature', ['fork']),
      makeCommit('main', ['fork']),
      makeCommit('fork', ['root']),
      makeCommit('root', []),
    ];

    const simplified = simplifyCommits(commits);
    expect(simplified.map(c => c.hash)).toEqual(['merge', 'fork', 'root']);
    expect(simplified[0].parents).toEqual(['fork']);
  });

  it('rewires parents across dropped linear commits on a feature branch', () => {
    const commits = [
      makeCommit('tip', ['c3'], [{ type: 'branch', name: 'feature' }]),
      makeCommit('c3', ['c2']),
      makeCommit('c2', ['base']),
      makeCommit('base', ['root'], [{ type: 'branch', name: 'main' }]),
      makeCommit('root', []),
    ];

    const simplified = simplifyCommits(commits);
    expect(simplified.map(c => c.hash)).toEqual(['tip', 'base', 'root']);
    expect(simplified[0].parents).toEqual(['base']);
  });

  it('preserves the uncommitted virtual row', () => {
    const commits = [
      makeCommit('UNCOMMITTED', ['head'], [{ type: 'working-dir', name: 'Uncommitted changes' }]),
      makeCommit('head', ['c1'], [{ type: 'head', name: 'HEAD' }]),
      makeCommit('c1', []),
    ];

    const simplified = simplifyCommits(commits);
    expect(simplified.map(c => c.hash)).toEqual(['UNCOMMITTED', 'head', 'c1']);
  });
});
