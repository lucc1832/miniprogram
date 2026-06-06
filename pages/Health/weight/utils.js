const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateBefore(days) {
  return formatDate(new Date(Date.now() - days * DAY_MS));
}

function randomKey(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function xorHexEncode(text, key) {
  const output = [];
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    output.push(value.toString(16).padStart(2, '0'));
  }
  return output.join('');
}

function xorHexDecode(hex, key) {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const value = parseInt(hex.slice(i, i + 2), 16);
    result += String.fromCharCode(value ^ key.charCodeAt((i / 2) % key.length));
  }
  return result;
}

function normalizeRecordStore(value) {
  const empty = { user1: [], user2: [] };
  if (Array.isArray(value)) return { ...empty, user1: value };
  if (!value || typeof value !== 'object') return empty;
  return {
    user1: Array.isArray(value.user1) ? value.user1 : [],
    user2: Array.isArray(value.user2) ? value.user2 : []
  };
}

function sortRecords(records, descending = false) {
  return (records || []).slice().sort((a, b) => {
    return descending
      ? String(b.date || '').localeCompare(String(a.date || ''))
      : String(a.date || '').localeCompare(String(b.date || ''));
  });
}

function calculateStreak(records, today) {
  const sorted = sortRecords(records, true);
  if (!sorted.length) return 0;

  const yesterday = formatDate(new Date(new Date(today).getTime() - DAY_MS));
  const latest = sorted[0].date;
  if (latest !== today && latest !== yesterday) return 0;

  let count = 0;
  const expected = new Date(latest);
  for (const record of sorted) {
    if (record.date !== formatDate(expected)) break;
    count += 1;
    expected.setDate(expected.getDate() - 1);
  }
  return count;
}

module.exports = {
  DAY_MS,
  formatDate,
  getDateBefore,
  randomKey,
  xorHexEncode,
  xorHexDecode,
  normalizeRecordStore,
  sortRecords,
  calculateStreak
};
