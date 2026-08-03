// Real Fleur snapshot copied from #fleur-data 2026-08-03
const validFleurMessage = {
  ts: '1785748709.370249',
  text: '[hex-snapshot] 2026-08-02\n```{"fetchedAt":1785748699831,"dau":1742,"mau":30630,"retentionD1":0.1711,"retentionD7":0.0399,"revenue":41.185,"installs":948,"installToDauRatio":0.5442,"dauByCountry":{"US":935,"PH":446,"GB":261,"CA":88,"SG":2},"retentionByCountry":{"US":{"D1":0.1938,"D7":0.0493},"PH":{"D1":0.1408,"D7":0.0179},"GB":{"D1":0.1610,"D7":0.0408}}}```\n*Sent using* <@U0AFTLWK83S|Claude>',
};

// Same but with explicit ```json fence (also valid — the parser should accept both)
const validFencedJsonMessage = {
  ts: '1785748709.370250',
  text: '[hex-snapshot] 2026-08-02\n```json\n{"fetchedAt":1785748699831,"dau":1742}\n```',
};

// Message without the marker — should be skipped
const noMarkerMessage = {
  ts: '1785748709.370251',
  text: 'unrelated chatter in #fleur-data',
};

// Message with marker but no fenced JSON — should return null (broken snapshot)
const markerNoJsonMessage = {
  ts: '1785748709.370252',
  text: '[hex-snapshot] 2026-08-02\nsomeone forgot the JSON block',
};

// Message with malformed JSON — should return null
const malformedJsonMessage = {
  ts: '1785748709.370253',
  text: '[hex-snapshot] 2026-08-02\n```{not: valid, json}```',
};

module.exports = {
  validFleurMessage,
  validFencedJsonMessage,
  noMarkerMessage,
  markerNoJsonMessage,
  malformedJsonMessage,
};
