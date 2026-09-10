import type { Commit } from './types';

/** Drop linear intermediate commits, keeping branch tips, merges, and forks. */
export function simplifyCommits(commits: Commit[]): Commit[] {
  if (commits.length <= 2) return commits;

  const hashToCommit = new Map<string, Commit>();
  for (const commit of commits) {
    hashToCommit.set(commit.hash, commit);
  }

  const childCount = new Map<string, number>();
  for (const commit of commits) {
    for (const parent of commit.parents) {
      if (!hashToCommit.has(parent)) continue;
      childCount.set(parent, (childCount.get(parent) ?? 0) + 1);
    }
  }

  const keep = new Set<string>();
  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    if (commit.hash === 'UNCOMMITTED') {
      keep.add(commit.hash);
      continue;
    }
    if (i === 0 || i === commits.length - 1) {
      keep.add(commit.hash);
      continue;
    }
    if (commit.refs.length > 0) {
      keep.add(commit.hash);
      continue;
    }
    if (commit.parents.length > 1) {
      keep.add(commit.hash);
      continue;
    }
    if ((childCount.get(commit.hash) ?? 0) > 1) {
      keep.add(commit.hash);
    }
  }

  function nearestKeptAncestor(hash: string, visiting = new Set<string>()): string | null {
    if (keep.has(hash)) return hash;
    if (visiting.has(hash)) return null;
    visiting.add(hash);
    const commit = hashToCommit.get(hash);
    if (!commit) return null;
    for (const parent of commit.parents) {
      const kept = nearestKeptAncestor(parent, visiting);
      if (kept) return kept;
    }
    return null;
  }

  const simplified: Commit[] = [];
  for (const commit of commits) {
    if (!keep.has(commit.hash)) continue;

    const parents: string[] = [];
    const seen = new Set<string>();
    for (const parent of commit.parents) {
      const kept = nearestKeptAncestor(parent);
      if (!kept || kept === commit.hash || seen.has(kept)) continue;
      seen.add(kept);
      parents.push(kept);
    }

    simplified.push(parents.length === commit.parents.length && parents.every((p, i) => p === commit.parents[i])
      ? commit
      : { ...commit, parents });
  }

  return simplified;
}
