"""Shared development-data guards; never reads held-out benchmark contents."""
import re
import unicodedata
from pathlib import Path


def guard_training_path(path):
    resolved = Path(path).expanduser().resolve()
    if any('frozen' in p.lower() or 'petalpal-in-domain-v1' in p.lower()
           or p.lower() in {'evaluation', 'hybrid-test-v2'} for p in resolved.parts):
        raise ValueError(f'Benchmark data is forbidden in development: {resolved}')
    return resolved


def normalize(text):
    return re.sub(r'[^\w]+', '', unicodedata.normalize('NFKC', text).casefold())


def source_key(row):
    provenance = row.get('provenance')
    url = (provenance.get('sourceUrl') if isinstance(provenance, dict) else None) or row.get('sourceUrl') or ''
    match = re.search(r'(?:reddit\.com/r/[^/]+/comments/|redd\.it/)([a-z0-9]+)', url, re.I)
    return 'reddit:' + match[1].lower() if match else url.rstrip('/').lower() or row.get('sourceGroupId')


def assert_disjoint(train, dev):
    for name, key in [('normalized journal', lambda r: normalize(r['journal'])),
                      ('source group', lambda r: r.get('sourceGroupId')),
                      ('canonical source', source_key)]:
        overlap = {key(r) for r in train if key(r)} & {key(r) for r in dev if key(r)}
        if overlap:
            raise ValueError(f'Train/Dev {name} overlap: {len(overlap)}')


def accumulation_weight(batch_index, row_count, batch_size, accumulation):
    """Weight each mean batch loss by its samples in this optimizer update."""
    start = (batch_index // accumulation) * accumulation * batch_size
    count = min(accumulation * batch_size, row_count - start)
    current = min(batch_size, row_count - batch_index * batch_size)
    return current / count
