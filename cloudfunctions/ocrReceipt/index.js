const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';

let tokenCache = {
  accessToken: '',
  expiresAt: 0
};

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function requestJson(url, options = {}, body = '') {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          const data = JSON.parse(text || '{}');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(data.error_description || data.error_msg || `HTTP ${res.statusCode}`));
          }
        } catch (err) {
          reject(new Error(`接口返回解析失败：${text.slice(0, 120)}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function getBaiduKeys() {
  const apiKey = process.env.BAIDU_OCR_API_KEY;
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('缺少百度OCR环境变量 BAIDU_OCR_API_KEY / BAIDU_OCR_SECRET_KEY');
  }

  return { apiKey, secretKey };
}

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60000) {
    return tokenCache.accessToken;
  }

  let keys;
  try {
    keys = getBaiduKeys();
  } catch (err) {
    err.stage = 'env';
    throw err;
  }
  const { apiKey, secretKey } = keys;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: apiKey,
    client_secret: secretKey
  });

  let data;
  try {
    data = await requestJson(`${TOKEN_URL}?${params.toString()}`, {
      method: 'POST'
    });
  } catch (err) {
    err.stage = 'token';
    throw err;
  }

  if (!data.access_token) {
    throw new Error(data.error_description || '获取百度OCR access_token 失败');
  }

  const expiresIn = Number(data.expires_in || 2592000);
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + Math.max(60, expiresIn - 300) * 1000
  };

  return tokenCache.accessToken;
}

async function downloadImageBase64(fileID) {
  if (!fileID) throw new Error('缺少图片 fileID');

  let res;
  try {
    res = await cloud.downloadFile({ fileID });
  } catch (err) {
    err.stage = 'download';
    throw err;
  }
  const buffer = res.fileContent;
  if (!buffer || !buffer.length) {
    throw new Error('图片下载失败');
  }

  return buffer.toString('base64');
}

async function recognizeByBaidu(imageBase64) {
  const accessToken = await getAccessToken();
  const params = new URLSearchParams({
    image: imageBase64,
    language_type: 'CHN_ENG',
    detect_direction: 'true',
    probability: 'true'
  });
  const body = params.toString();

  let data;
  try {
    data = await requestJson(`${OCR_URL}?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);
  } catch (err) {
    err.stage = 'baidu_ocr';
    throw err;
  }

  if (data.error_code) {
    const err = new Error(data.error_msg || `百度OCR错误：${data.error_code}`);
    err.stage = 'baidu_ocr';
    throw err;
  }

  return data;
}

function normalizeOcrText(ocrResult) {
  const items = ocrResult && (ocrResult.words_result || ocrResult.words_result_num && []);
  if (Array.isArray(items) && items.length) {
    return items
      .map(item => item.words || '')
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function normalizeDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d || m > 12 || d > 31) return '';
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseDate(text) {
  const patterns = [
    /(20\d{2})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})/,
    /(20\d{2})(\d{2})(\d{2})/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const date = normalizeDate(match[1], match[2], match[3]);
      if (date) return date;
    }
  }
  return '';
}

function extractAmounts(line) {
  const cleaned = line.replace(/[,，]/g, '');
  const matches = cleaned.match(/(?:￥|¥|CNY|RMB)?\s*(\d{1,6}(?:\.\d{1,2})?)/ig) || [];
  return matches
    .map(raw => Number(String(raw).replace(/[^\d.]/g, '')))
    .filter(num => isFinite(num) && num > 0 && num < 100000);
}

function parsePrice(lines) {
  const strongWords = /(实付|付款|支付|合计|总计|订单金额|商品金额|金额|应付|小计|¥|￥)/;
  const weakWords = /(优惠|红包|退款|运费|减免|积分|余额)/;
  const candidates = [];

  lines.forEach((line, index) => {
    const amounts = extractAmounts(line);
    if (!amounts.length) return;

    amounts.forEach(amount => {
      let score = 1;
      if (strongWords.test(line)) score += 4;
      if (weakWords.test(line)) score -= 2;
      if (/\.\d{1,2}/.test(String(amount))) score += 1;
      candidates.push({ amount, score, index });
    });
  });

  if (!candidates.length) return '';
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.amount - a.amount;
  });
  return candidates[0].amount.toFixed(2).replace(/\.00$/, '');
}

function looksLikeAddressLine(line) {
  if (/\*{2,}/.test(line)) return true;
  if (/1[3-9]\d[\d*\s-]{5,}/.test(line)) return true;
  if (/(收货人|收件人|收货地址|地址|联系电话|手机号|电话)/.test(line)) return true;

  const addressTokens = ['省', '市', '区', '县', '镇', '乡', '村', '街道', '小区', '单元', '楼', '室', '路', '弄', '号'];
  const hitCount = addressTokens.reduce((count, token) => count + (line.includes(token) ? 1 : 0), 0);
  return hitCount >= 2;
}

function looksLikeOrderNoise(line) {
  return /(订单|支付|付款|实付|合计|总计|金额|优惠|红包|运费|收货|地址|电话|发票|日期|时间|编号|单号|店铺|客服|快递|物流|退款|积分|余额|已完成|交易成功|规格|数量|小计|配送|服务|保障|评价|联系卖家)/.test(line);
}

function getCharProfile(line) {
  const chars = Array.from(line);
  const chinese = chars.filter(ch => /[\u4e00-\u9fa5]/.test(ch)).length;
  const letters = chars.filter(ch => /[A-Za-z]/.test(ch)).length;
  const digits = chars.filter(ch => /\d/.test(ch)).length;
  const symbols = chars.filter(ch => !/[\u4e00-\u9fa5A-Za-z0-9\s]/.test(ch)).length;

  return {
    length: chars.length,
    chinese,
    letters,
    digits,
    symbols
  };
}

function looksLikeTimeOrNoise(line) {
  const profile = getCharProfile(line);

  if (/([01]?\d|2[0-3])[:：][0-5]\d/.test(line)) return true;
  if (/@/.test(line)) return true;
  if (profile.length <= 12 && profile.digits >= 2 && profile.symbols >= 1) return true;
  if (profile.length > 0 && profile.symbols / profile.length > 0.22) return true;
  if (profile.chinese <= 1 && profile.letters <= 1 && profile.digits >= 2) return true;

  return false;
}

function getProductKeywordScore(lines, index) {
  const start = Math.max(0, index - 3);
  const end = Math.min(lines.length - 1, index + 2);
  let score = 0;

  for (let i = start; i <= end; i += 1) {
    const line = lines[i] || '';
    if (/(商品|宝贝|名称|标题|规格|型号|颜色|款式)/.test(line)) {
      score += 8 - Math.abs(index - i);
    }
  }

  return score;
}

function parseName(lines) {
  const candidates = lines
    .map(line => line.replace(/\s+/g, ' ').trim())
    .map((line, index) => ({ line, index }))
    .filter(item => item.line.length >= 2 && item.line.length <= 36)
    .filter(item => !looksLikeAddressLine(item.line))
    .filter(item => !looksLikeOrderNoise(item.line))
    .filter(item => !looksLikeTimeOrNoise(item.line))
    .filter(item => !parseDate(item.line))
    .filter(item => !/^(￥|¥)?\d+(\.\d+)?$/.test(item.line))
    .filter(item => !/^[A-Za-z0-9*_\-\s]+$/.test(item.line))
    .map(({ line, index }) => {
      const profile = getCharProfile(line);
      const keywordScore = getProductKeywordScore(lines, index);
      const score =
        line.length +
        (profile.chinese >= 2 ? 14 : 0) +
        (profile.chinese >= 4 ? 6 : 0) +
        (profile.letters >= 2 && profile.chinese >= 1 ? 3 : 0) +
        keywordScore -
        profile.symbols * 5 -
        index;

      return {
        line,
        score,
        keywordScore,
        profile
      };
    })
    .filter(item => item.keywordScore > 0 || item.score >= 22);

  if (!candidates.length) return '';
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].line;
}

function parseReceiptText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const normalized = lines.join('\n');
  const name = parseName(lines);
  const buyDate = parseDate(normalized);
  const buyPrice = parsePrice(lines);

  return {
    name,
    buyDate,
    buyPrice,
    confidence: [name, buyDate, buyPrice].filter(Boolean).length
  };
}

exports.main = async (event = {}) => {
  try {
    if (event.action === 'ping') {
      await getAccessToken();
      return {
        ok: true,
        provider: 'baidu',
        stage: 'ping',
        message: '百度OCR配置正常'
      };
    }

    if (event.action === 'parseText') {
      return {
        ok: true,
        provider: 'baidu',
        stage: 'parseText',
        parsed: parseReceiptText(event.text || '')
      };
    }

    const imageBase64 = await downloadImageBase64(event.fileID);
    const ocrResult = await recognizeByBaidu(imageBase64);
    const text = normalizeOcrText(ocrResult);

    return {
      ok: true,
      provider: 'baidu',
      parsed: parseReceiptText(text),
      text
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'baidu',
      stage: err && err.stage || 'unknown',
      message: err && err.message || 'OCR识别失败'
    };
  }
};
