const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStandardJson } = require('../src/parsers/standard-json');
const { parsers, resolveParser } = require('../src/parsers');
const {
  validFleurMessage,
  validFencedJsonMessage,
  noMarkerMessage,
  markerNoJsonMessage,
  malformedJsonMessage,
} = require('./fixtures/standard-json-messages');

test('parses real Fleur snapshot with bare ``` fence', () => {
  const snap = parseStandardJson(validFleurMessage);
  assert.equal(snap.fetchedAt, 1785748699831);
  assert.equal(snap.dau, 1742);
  assert.equal(snap.mau, 30630);
  assert.equal(snap.revenue, 41.185);
  assert.deepEqual(snap.dauByCountry, { US: 935, PH: 446, GB: 261, CA: 88, SG: 2 });
});

test('parses snapshot with explicit ```json fence', () => {
  const snap = parseStandardJson(validFencedJsonMessage);
  assert.equal(snap.fetchedAt, 1785748699831);
  assert.equal(snap.dau, 1742);
});

test('returns null when [hex-snapshot] marker missing', () => {
  assert.equal(parseStandardJson(noMarkerMessage), null);
});

test('returns null when marker present but no fenced block', () => {
  assert.equal(parseStandardJson(markerNoJsonMessage), null);
});

test('returns null when JSON is malformed', () => {
  assert.equal(parseStandardJson(malformedJsonMessage), null);
});

test('parsers.standardJson is the same function', () => {
  assert.equal(parsers.standardJson, parseStandardJson);
});

test('resolveParser("standard-json") returns parseStandardJson', () => {
  assert.equal(resolveParser('standard-json'), parseStandardJson);
});

test('resolveParser passes through custom function', () => {
  const custom = () => null;
  assert.equal(resolveParser(custom), custom);
});

test('resolveParser throws on unknown preset name', () => {
  assert.throws(() => resolveParser('nope'), /Unknown parser preset/);
});
