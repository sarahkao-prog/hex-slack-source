const { parseStandardJson } = require('./standard-json');

const parsers = {
  standardJson: parseStandardJson,
};

const PRESET_MAP = {
  'standard-json': parseStandardJson,
};

function resolveParser(nameOrFn) {
  if (typeof nameOrFn === 'function') return nameOrFn;
  const resolved = PRESET_MAP[nameOrFn];
  if (!resolved) {
    throw new Error(`Unknown parser preset: ${nameOrFn}. Known: ${Object.keys(PRESET_MAP).join(', ')}`);
  }
  return resolved;
}

module.exports = { parsers, resolveParser };
