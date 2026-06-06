const COLLECTION = 'user_storage';
const COLLECTION_MISSING_CODE = -502005;
const OPENID_STORAGE_KEY = 'cloud_openid';
const ACCOUNT_ID_STORAGE_KEY = 'bound_account_id';
const ACCOUNT_PHONE_MASK_KEY = 'bound_phone_mask';
const ACCOUNT_VERIFIED_KEY = 'bound_account_verified';
const ACCOUNT_AUTH_KEY = '__account_auth__';
const BACKUP_KEY_PREFIX = 'cloud_backup_';
const BACKUP_COLLECTIONS = ['categories', 'goods', 'roi_logs', 'use_logs', 'orders'];

let autoSyncEnabled = false;
let suspended = false;
let originalSetStorageSync = null;
let originalRemoveStorageSync = null;
let collectionAvailable = true;
let openidPromise = null;

function getDb() {
  if (!wx.cloud) throw new Error('cloud unavailable');
  return wx.cloud.database();
}

async function callOpenidFunction(name) {
  const res = await wx.cloud.callFunction({ name, data: {} });
  return res && res.result && (res.result.openid || res.result.OPENID || res.result.userInfo && res.result.userInfo.openId);
}

async function getOpenid() {
  const cached = wx.getStorageSync(OPENID_STORAGE_KEY);
  if (cached) return cached;

  if (!openidPromise) {
    openidPromise = (async () => {
      let openid = '';
      try {
        openid = await callOpenidFunction('getOpenid');
      } catch (err) {
        try {
          openid = await callOpenidFunction('login');
        } catch (fallbackErr) {
          console.warn('get openid failed', err, fallbackErr);
        }
      }

      if (!openid) throw new Error('当前用户身份获取失败，请先部署 getOpenid 云函数');
      wx.setStorageSync(OPENID_STORAGE_KEY, openid);
      return openid;
    })().finally(() => {
      openidPromise = null;
    });
  }

  return openidPromise;
}

function shouldSyncKey(key) {
  return typeof key === 'string' && key && !key.startsWith('__');
}

function isCloudBackupKey(key) {
  return typeof key === 'string' && key.startsWith(BACKUP_KEY_PREFIX);
}

function shouldMirrorLocalKey(key) {
  return shouldSyncKey(key)
    && key !== OPENID_STORAGE_KEY
    && key !== ACCOUNT_ID_STORAGE_KEY
    && key !== ACCOUNT_PHONE_MASK_KEY
    && key !== ACCOUNT_VERIFIED_KEY
    && key !== ACCOUNT_AUTH_KEY
    && !isCloudBackupKey(key);
}

function isCollectionMissing(err) {
  const code = Number(err && err.errCode);
  const msg = String(err && (err.errMsg || err.message || ''));
  return code === COLLECTION_MISSING_CODE || /DATABASE_COLLECTION_NOT_EXIST|Db or Table not exist|collection not exists/i.test(msg);
}

function markCollectionMissing(err) {
  if (!isCollectionMissing(err)) return false;
  collectionAvailable = false;
  console.warn(`云数据库集合 ${COLLECTION} 不存在，请在云开发控制台创建后再同步。`, err);
  return true;
}

function isOwnDoc(row, openid) {
  if (!row || !openid) return false;
  return row.ownerOpenid === openid || row._openid === openid;
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function hashAccountId(phone) {
  const normalized = normalizePhone(phone);
  if (!/^1\d{10}$/.test(normalized)) {
    throw new Error('请输入正确的手机号');
  }

  let hash = 2166136261;
  const input = `mmy:${normalized}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `phone_${(hash >>> 0).toString(16)}`;
}

function maskPhone(phone) {
  const normalized = normalizePhone(phone);
  return normalized.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 6 || value.length > 32) {
    throw new Error('密码需要 6-32 位');
  }
  if (/\s/.test(value)) {
    throw new Error('密码不能包含空格');
  }
  return value;
}

function toUtf8Bytes(input) {
  const str = String(input || '');
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = str.charCodeAt(++i);
      code = 0x10000 + (((code & 0x3ff) << 10) | (next & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256(input) {
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const bytes = toUtf8Bytes(input);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push((bitLength / Math.pow(2, i * 8)) & 0xff);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  return h.map(item => item.toString(16).padStart(8, '0')).join('');
}

function hashPassword(accountId, password) {
  return sha256(`mmy-account:v1:${accountId}:${validatePassword(password)}`);
}

function getAccountInfo() {
  const verified = wx.getStorageSync(ACCOUNT_VERIFIED_KEY) === '1';
  return {
    accountId: verified ? wx.getStorageSync(ACCOUNT_ID_STORAGE_KEY) || '' : '',
    phoneMask: verified ? wx.getStorageSync(ACCOUNT_PHONE_MASK_KEY) || '' : '',
    verified
  };
}

function setAccountBinding(accountId, phoneMask) {
  wx.setStorageSync(ACCOUNT_ID_STORAGE_KEY, accountId);
  wx.setStorageSync(ACCOUNT_PHONE_MASK_KEY, phoneMask);
  wx.setStorageSync(ACCOUNT_VERIFIED_KEY, '1');
  return { accountId, phoneMask, verified: true };
}

function clearAccountBinding() {
  wx.removeStorageSync(ACCOUNT_ID_STORAGE_KEY);
  wx.removeStorageSync(ACCOUNT_PHONE_MASK_KEY);
  wx.removeStorageSync(ACCOUNT_VERIFIED_KEY);
}

async function getAccountAuthDoc(accountId) {
  collectionAvailable = true;
  const db = getDb();
  try {
    const res = await db.collection(COLLECTION)
      .where({ key: ACCOUNT_AUTH_KEY, accountId })
      .orderBy('updatedAt', 'desc')
      .limit(5)
      .get();
    return (res.data || []).find(row => row.deleted !== true) || null;
  } catch (err) {
    if (markCollectionMissing(err)) {
      throw new Error('请先在云开发数据库创建 user_storage 集合');
    }
    throw err;
  }
}

async function registerAccount(phone, password) {
  const normalized = normalizePhone(phone);
  const accountId = hashAccountId(normalized);
  const phoneMask = maskPhone(normalized);
  const passwordHash = hashPassword(accountId, password);
  const existing = await getAccountAuthDoc(accountId);

  if (existing && existing.value && existing.value.passwordHash) {
    throw new Error('这个手机号已经注册，请直接登录');
  }

  const now = Date.now();
  await getDb().collection(COLLECTION).add({
    data: {
      key: ACCOUNT_AUTH_KEY,
      accountId,
      ownerOpenid: await getOpenid(),
      deleted: false,
      updatedAt: now,
      value: {
        phoneMask,
        passwordHash,
        createdAt: now,
        lastLoginAt: now
      }
    }
  });

  return setAccountBinding(accountId, phoneMask);
}

async function loginAccount(phone, password) {
  const normalized = normalizePhone(phone);
  const accountId = hashAccountId(normalized);
  const phoneMask = maskPhone(normalized);
  const passwordHash = hashPassword(accountId, password);
  const existing = await getAccountAuthDoc(accountId);

  if (!existing || !existing.value || !existing.value.passwordHash) {
    throw new Error('账号不存在，请先注册');
  }
  if (existing.value.passwordHash !== passwordHash) {
    throw new Error('手机号或密码不正确');
  }

  const now = Date.now();
  try {
    await getDb().collection(COLLECTION).doc(existing._id).update({
      data: {
        ownerOpenid: await getOpenid(),
        updatedAt: now,
        value: {
          ...existing.value,
          phoneMask,
          lastLoginAt: now
        }
      }
    });
  } catch (err) {
    console.warn('update account login time failed', err);
  }

  return setAccountBinding(accountId, phoneMask);
}

async function getScope() {
  const account = getAccountInfo();
  return {
    openid: await getOpenid(),
    accountId: account.accountId || ''
  };
}

function hasAccount(row) {
  return !!(row && row.accountId);
}

function isScopedDoc(row, scope) {
  if (!row || !scope) return false;
  if (scope.accountId) return row.accountId === scope.accountId;
  return !row.accountId && isOwnDoc(row, scope.openid);
}

function filterScopedRows(rows, scope) {
  return (rows || []).filter(row => isScopedDoc(row, scope));
}

function cloneDoc(doc) {
  return JSON.parse(JSON.stringify(doc || {}));
}

function stripCloudFields(doc, scope) {
  const data = cloneDoc(doc);
  delete data._id;
  delete data._openid;
  data.ownerOpenid = scope.openid;
  if (scope.accountId) data.accountId = scope.accountId;
  else delete data.accountId;
  return data;
}

async function getExistingOwnStorageDoc(collection, key, scope) {
  const res = await collection.where({ key }).orderBy('updatedAt', 'desc').limit(20).get();
  const rows = filterScopedRows(res.data || [], scope);
  return rows[0] || null;
}

async function set(key, value) {
  if (!collectionAvailable || !shouldSyncKey(key)) return false;

  const scope = await getScope();
  const db = getDb();
  const collection = db.collection(COLLECTION);
  const now = Date.now();
  const data = {
    key,
    value,
    ownerOpenid: scope.openid,
    deleted: false,
    updatedAt: now
  };
  if (scope.accountId) data.accountId = scope.accountId;

  try {
    const existing = await getExistingOwnStorageDoc(collection, key, scope);
    if (existing) {
      await collection.doc(existing._id).update({ data });
    } else {
      await collection.add({ data });
    }
  } catch (err) {
    if (markCollectionMissing(err)) return false;
    throw err;
  }

  return true;
}

async function get(key, fallback = '') {
  if (!collectionAvailable || !shouldSyncKey(key)) return fallback;

  const scope = await getScope();
  const db = getDb();
  try {
    const res = await db.collection(COLLECTION).where({ key }).orderBy('updatedAt', 'desc').limit(20).get();
    const rows = getLatestRows(filterScopedRows(res.data || [], scope));
    const row = rows.find(item => item.deleted !== true);
    if (!row) return fallback;
    return Object.prototype.hasOwnProperty.call(row, 'value') ? row.value : fallback;
  } catch (err) {
    if (markCollectionMissing(err)) return fallback;
    throw err;
  }
}

async function remove(key) {
  if (!collectionAvailable || !shouldSyncKey(key)) return false;

  const scope = await getScope();
  const db = getDb();
  const collection = db.collection(COLLECTION);
  try {
    const existing = await getExistingOwnStorageDoc(collection, key, scope);
    if (existing) {
      const data = {
        ownerOpenid: scope.openid,
        deleted: true,
        updatedAt: Date.now()
      };
      if (scope.accountId) data.accountId = scope.accountId;
      await collection.doc(existing._id).update({ data });
    }
  } catch (err) {
    if (markCollectionMissing(err)) return false;
    throw err;
  }

  return true;
}

async function listStorageRows(includeDeleted = false) {
  if (!collectionAvailable) return [];

  const scope = await getScope();
  const db = getDb();
  const collection = db.collection(COLLECTION);
  const pageSize = 100;
  let skip = 0;
  let rows = [];

  try {
    while (true) {
      const res = await collection.skip(skip).limit(pageSize).get();
      const data = res.data || [];
      rows = rows.concat(data);
      if (data.length < pageSize) break;
      skip += pageSize;
    }
  } catch (err) {
    if (markCollectionMissing(err)) return [];
    throw err;
  }

  const ownRows = filterScopedRows(rows, scope)
    .filter(row => shouldSyncKey(row.key) && Object.prototype.hasOwnProperty.call(row, 'value'));
  return getLatestRows(includeDeleted ? ownRows : ownRows.filter(row => row.deleted !== true));
}

function listAll() {
  return listStorageRows(false);
}

function listAllIncludingDeleted() {
  return listStorageRows(true);
}

async function readCollectionRows(name) {
  const scope = await getScope();
  const db = getDb();
  const collection = db.collection(name);
  const pageSize = 100;
  let skip = 0;
  let rows = [];

  while (true) {
    const res = await collection.skip(skip).limit(pageSize).get();
    const data = res.data || [];
    rows = rows.concat(data);
    if (data.length < pageSize) break;
    skip += pageSize;
  }

  return filterScopedRows(rows, scope);
}

async function getUserRows(name) {
  return readCollectionRows(name);
}

async function addUserDoc(name, data) {
  const scope = await getScope();
  const doc = {
    ...cloneDoc(data),
    ownerOpenid: scope.openid
  };
  if (scope.accountId) doc.accountId = scope.accountId;
  return getDb().collection(name).add({
    data: doc
  });
}

async function getUserDoc(name, id) {
  const scope = await getScope();
  const res = await getDb().collection(name).doc(id).get();
  if (!isScopedDoc(res.data, scope)) {
    throw new Error('无权访问这条数据');
  }
  return res;
}

async function updateUserDoc(name, id, data) {
  await getUserDoc(name, id);
  const scope = await getScope();
  const next = {
    ...cloneDoc(data),
    ownerOpenid: scope.openid
  };
  if (scope.accountId) next.accountId = scope.accountId;
  return getDb().collection(name).doc(id).update({
    data: next
  });
}

async function removeUserDoc(name, id) {
  await getUserDoc(name, id);
  return getDb().collection(name).doc(id).remove();
}

async function removeCollectionRows(name) {
  const rows = await readCollectionRows(name);
  let removed = 0;

  for (const row of rows) {
    if (!row._id) continue;
    await getDb().collection(name).doc(row._id).remove();
    removed += 1;
  }

  return removed;
}

async function clearCurrentStorage(keys) {
  const targets = Array.isArray(keys) ? keys.filter(shouldMirrorLocalKey) : [];
  const result = {
    total: targets.length,
    success: 0,
    failed: 0,
    failedKeys: []
  };

  for (const key of targets) {
    try {
      await remove(key);
      result.success += 1;
    } catch (err) {
      console.warn('clear current storage failed:', key, err);
      result.failed += 1;
      result.failedKeys.push(key);
    }
  }

  return result;
}

async function backupCloudCollections(names = BACKUP_COLLECTIONS) {
  const result = {
    collections: 0,
    documents: 0,
    failed: 0,
    failedCollections: []
  };

  for (const name of names) {
    try {
      const docs = await readCollectionRows(name);
      await set(`${BACKUP_KEY_PREFIX}${name}`, {
        name,
        backedUpAt: Date.now(),
        docs
      });
      result.collections += 1;
      result.documents += docs.length;
    } catch (err) {
      if (isCollectionMissing(err)) {
        await set(`${BACKUP_KEY_PREFIX}${name}`, {
          name,
          backedUpAt: Date.now(),
          docs: []
        });
        result.collections += 1;
        continue;
      }
      console.warn('backup cloud collection failed:', name, err);
      result.failed += 1;
      result.failedCollections.push(name);
    }
  }

  return result;
}

async function clearCloudCollections(names = BACKUP_COLLECTIONS) {
  const result = {
    collections: 0,
    documents: 0,
    failed: 0,
    failedCollections: []
  };

  for (const name of names) {
    try {
      const removed = await removeCollectionRows(name);
      result.collections += 1;
      result.documents += removed;
    } catch (err) {
      if (isCollectionMissing(err)) {
        result.collections += 1;
        continue;
      }
      console.warn('clear cloud collection failed:', name, err);
      result.failed += 1;
      result.failedCollections.push(name);
    }
  }

  return result;
}

async function restoreCloudCollectionsFromRows(rows) {
  const scope = await getScope();
  const backupMap = {};
  (rows || []).forEach(row => {
    if (!isCloudBackupKey(row.key) || !row.value) return;
    const name = row.key.replace(BACKUP_KEY_PREFIX, '');
    const docs = Array.isArray(row.value.docs) ? row.value.docs : [];
    backupMap[name] = docs;
  });

  const names = BACKUP_COLLECTIONS.filter(name => Object.prototype.hasOwnProperty.call(backupMap, name));
  const result = {
    collections: 0,
    documents: 0,
    failed: 0,
    failedCollections: []
  };

  if (!names.length) return result;

  const db = getDb();
  const categoryIdMap = {};
  const goodsIdMap = {};

  try {
    await clearCloudCollections(names.slice().reverse());

    if (backupMap.categories) {
      for (const doc of backupMap.categories) {
        const oldId = doc._id;
        const res = await db.collection('categories').add({ data: stripCloudFields(doc, scope) });
        if (oldId && res._id) categoryIdMap[oldId] = res._id;
        result.documents += 1;
      }
      result.collections += 1;
    }

    if (backupMap.goods) {
      for (const doc of backupMap.goods) {
        const oldId = doc._id;
        const data = stripCloudFields(doc, scope);
        if (data.categoryId && categoryIdMap[data.categoryId]) {
          data.categoryId = categoryIdMap[data.categoryId];
        }
        const res = await db.collection('goods').add({ data });
        if (oldId && res._id) goodsIdMap[oldId] = res._id;
        result.documents += 1;
      }
      result.collections += 1;
    }

    const restorePlainCollection = async (name) => {
      if (!backupMap[name]) return;
      for (const doc of backupMap[name]) {
        const data = stripCloudFields(doc, scope);
        if (data.goodsId && goodsIdMap[data.goodsId]) {
          data.goodsId = goodsIdMap[data.goodsId];
        }
        await db.collection(name).add({ data });
        result.documents += 1;
      }
      result.collections += 1;
    };

    await restorePlainCollection('roi_logs');
    await restorePlainCollection('use_logs');
    await restorePlainCollection('orders');
  } catch (err) {
    console.warn('restore cloud collections failed:', err);
    result.failed = 1;
    result.failedCollections = names;
  }

  return result;
}

function getLatestRows(rows) {
  const sorted = (rows || []).slice().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  const seen = new Set();
  const result = [];

  sorted.forEach(row => {
    if (!shouldSyncKey(row.key) || seen.has(row.key)) return;
    seen.add(row.key);
    result.push(row);
  });

  return result;
}

function getLocalKeys() {
  try {
    const info = wx.getStorageInfoSync();
    return Array.isArray(info.keys) ? info.keys : [];
  } catch (e) {
    console.warn('get local storage keys failed', e);
    return [];
  }
}

async function migrateLocalStorage(keys) {
  collectionAvailable = true;

  const localKeys = Array.isArray(keys) && keys.length ? keys : getLocalKeys();
  const result = {
    total: localKeys.length,
    success: 0,
    failed: 0,
    failedKeys: [],
    collectionMissing: false
  };

  for (const key of localKeys) {
    if (!shouldMirrorLocalKey(key)) continue;
    try {
      await set(key, wx.getStorageSync(key));
      if (!collectionAvailable) {
        result.collectionMissing = true;
        break;
      }
      result.success += 1;
    } catch (e) {
      if (markCollectionMissing(e)) {
        result.collectionMissing = true;
        break;
      }
      console.warn('migrate local storage failed:', key, e);
      result.failed += 1;
      result.failedKeys.push(key);
    }
  }

  if (!result.collectionMissing) {
    result.cloudBackup = await backupCloudCollections();
  }

  return result;
}

async function restoreAllToLocal(options = {}) {
  collectionAvailable = true;

  const overwrite = !!options.overwrite;
  const includeDeletedFallback = !!options.includeDeletedFallback;
  const restoreCollections = !!options.restoreCollections;
  const excludedKeys = new Set(options.excludeKeys || []);
  const localKeys = new Set(getLocalKeys());
  let rows = await listAll();
  let usedDeletedFallback = false;

  if (includeDeletedFallback) {
    const activeKeys = new Set(rows.map(row => row.key));
    const deletedFallbackRows = (await listAllIncludingDeleted()).filter(row => !activeKeys.has(row.key));
    if (deletedFallbackRows.length) {
      rows = rows.concat(deletedFallbackRows);
      usedDeletedFallback = true;
    }
  }

  let restored = 0;
  let skipped = 0;
  const backupRows = rows.filter(row => isCloudBackupKey(row.key));
  const storageRows = rows.filter(row => !isCloudBackupKey(row.key));

  suspended = true;
  try {
    storageRows.forEach(row => {
      if (!shouldMirrorLocalKey(row.key)) return;
      if (excludedKeys.has(row.key)) return;
      if (!overwrite && localKeys.has(row.key)) {
        skipped += 1;
        return;
      }
      setLocalValue(row.key, row.value);
      restored += 1;
    });
  } finally {
    suspended = false;
  }

  const cloudRestore = restoreCollections
    ? await restoreCloudCollectionsFromRows(backupRows)
    : { collections: 0, documents: 0, failed: 0, failedCollections: [] };

  return {
    total: rows.length,
    restored: restored + cloudRestore.documents,
    localRestored: restored,
    skipped,
    usedDeletedFallback,
    cloudRestore
  };
}

function setLocalValue(key, value) {
  if (originalSetStorageSync) {
    originalSetStorageSync(key, value);
  } else {
    wx.setStorageSync(key, value);
  }
}

function enableAutoSync() {
  if (autoSyncEnabled || !wx || !wx.setStorageSync || !wx.removeStorageSync) return;

  originalSetStorageSync = wx.setStorageSync.bind(wx);
  originalRemoveStorageSync = wx.removeStorageSync.bind(wx);

  wx.setStorageSync = function patchedSetStorageSync(key, value) {
    const result = originalSetStorageSync(key, value);
    if (!suspended && shouldMirrorLocalKey(key)) {
      set(key, value).catch(err => console.warn('cloud storage mirror failed:', key, err));
    }
    return result;
  };

  wx.removeStorageSync = function patchedRemoveStorageSync(key) {
    const result = originalRemoveStorageSync(key);
    if (!suspended && shouldMirrorLocalKey(key)) {
      remove(key).catch(err => console.warn('cloud storage remove mirror failed:', key, err));
    }
    return result;
  };

  autoSyncEnabled = true;
}

function runWithoutAutoSync(fn) {
  suspended = true;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.finally(() => {
        suspended = false;
      });
    }
    suspended = false;
    return result;
  } catch (err) {
    suspended = false;
    throw err;
  }
}

module.exports = {
  COLLECTION,
  isCollectionMissing,
  getOpenid,
  getAccountInfo,
  registerAccount,
  loginAccount,
  clearAccountBinding,
  set,
  get,
  remove,
  listAll,
  getUserRows,
  addUserDoc,
  getUserDoc,
  updateUserDoc,
  removeUserDoc,
  clearCurrentStorage,
  backupCloudCollections,
  clearCloudCollections,
  migrateLocalStorage,
  restoreAllToLocal,
  enableAutoSync,
  runWithoutAutoSync
};
