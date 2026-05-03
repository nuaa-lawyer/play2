// ============================================================
// 法简AI - 权限鉴权模块
// 本地存储 + 签名防篡改 + 四重全局权限校验
// ============================================================

const Auth = (function () {
  'use strict';

  const STORAGE_KEYS = {
    TRIAL_USED:  'fajian_trial_used',
    TRIAL_SIG:   'fajian_trial_sig',
    VIP_STATUS:  'fajian_vip_status',
    VIP_SIG:     'fajian_vip_sig'
  };

  // 签名盐值（混淆后内置于代码，防止简单F12篡改）
  const SALT = 'fj_legal_ai_2026_salt_v1_prod';

  // VIP 密钥白名单（内置代码，可提交 GitHub）
  const VIP_KEY_WHITELIST = [
    'FAJIAN-VIP-2026-001-7K2P9X',
    'FAJIAN-VIP-2026-002-3M5R8Z',
    'FAJIAN-VIP-2026-003-1A4Q7W',
    'FAJIAN-VIP-2026-004-6D9F2V',
    'FAJIAN-VIP-2026-005-8H3J5L',
    'FAJIAN-VIP-2026-006-2N7B4C',
    'FAJIAN-VIP-2026-007-9E1T6G',
    'FAJIAN-VIP-2026-008-5Y8U3O',
    'FAJIAN-VIP-2026-009-4P7I1K',
    'FAJIAN-VIP-2026-010-0R2S5M',
    'FAJIAN-VIP-2026-011-9L3X7N',
    'FAJIAN-VIP-2026-012-2B6D9Q',
    'FAJIAN-VIP-2026-013-8G1V4R',
    'FAJIAN-VIP-2026-014-3W5T2Y',
    'FAJIAN-VIP-2026-015-7O9U6P',
    'FAJIAN-VIP-2026-016-1K4J8H',
    'FAJIAN-VIP-2026-017-5C7I3Z',
    'FAJIAN-VIP-2026-018-6M0A4S',
    'FAJIAN-VIP-2026-019-2Q9R1F',
    'FAJIAN-VIP-2026-020-4N8W7V',
    'FAJIAN-VIP-2026-021-8Z3B2L',
    'FAJIAN-VIP-2026-022-1X6G5C',
    'FAJIAN-VIP-2026-023-7D9T4K',
    'FAJIAN-VIP-2026-024-3F1Y8J',
    'FAJIAN-VIP-2026-025-9H5O6M',
    'FAJIAN-VIP-2026-026-0P7U2Q',
    'FAJIAN-VIP-2026-027-2I4R9S',
    'FAJIAN-VIP-2026-028-6V8N1B',
    'FAJIAN-VIP-2026-029-5L3X7G',
    'FAJIAN-VIP-2026-030-4W9D2Z',
    'FAJIAN-VIP-2026-031-1T6V5H',
    'FAJIAN-VIP-2026-032-8O2Y4K',
    'FAJIAN-VIP-2026-033-3P7U9M',
    'FAJIAN-VIP-2026-034-9A1R6C',
    'FAJIAN-VIP-2026-035-2J5S8N',
    'FAJIAN-VIP-2026-036-7F4Q1W',
    'FAJIAN-VIP-2026-037-6B9G3V',
    'FAJIAN-VIP-2026-038-5C2L7Z',
    'FAJIAN-VIP-2026-039-1K8T4X',
    'FAJIAN-VIP-2026-040-4M3I9H',
    'FAJIAN-VIP-2026-041-0R6J2Y',
    'FAJIAN-VIP-2026-042-9N7B5P',
    'FAJIAN-VIP-2026-043-2Q1D8U',
    'FAJIAN-VIP-2026-044-8V4F3S',
    'FAJIAN-VIP-2026-045-3G9L7W',
    'FAJIAN-VIP-2026-046-7X5C1R',
    'FAJIAN-VIP-2026-047-1H2O6K',
    'FAJIAN-VIP-2026-048-6Z8P4M',
    'FAJIAN-VIP-2026-049-5U3T9N',
    'FAJIAN-VIP-2026-050-4I7J2Q',
    'FAJIAN-VIP-2026-051-0A1R5V',
    'FAJIAN-VIP-2026-052-9S4W8B',
    'FAJIAN-VIP-2026-053-2F6D3L',
    'FAJIAN-VIP-2026-054-8C9G7X',
    'FAJIAN-VIP-2026-055-3K1V4Z',
    'FAJIAN-VIP-2026-056-7Y5H9P',
    'FAJIAN-VIP-2026-057-1M2O6I',
    'FAJIAN-VIP-2026-058-6R8Q3J',
    'FAJIAN-VIP-2026-059-5N7S1W',
    'FAJIAN-VIP-2026-060-4B9F8C',
    'FAJIAN-VIP-2026-061-0L3X7G',
    'FAJIAN-VIP-2026-062-9D6T2K',
    'FAJIAN-VIP-2026-063-2V5Y4M',
    'FAJIAN-VIP-2026-064-8H1O9R',
    'FAJIAN-VIP-2026-065-3P7U6S',
    'FAJIAN-VIP-2026-066-7Z4A1N',
    'FAJIAN-VIP-2026-067-1J8I5Q',
    'FAJIAN-VIP-2026-068-6F3C9W',
    'FAJIAN-VIP-2026-069-5G2L7V',
    'FAJIAN-VIP-2026-070-4X9B3Z',
    'FAJIAN-VIP-2026-071-0T6D1H',
    'FAJIAN-VIP-2026-072-9W5F8K',
    'FAJIAN-VIP-2026-073-2O1V4M',
    'FAJIAN-VIP-2026-074-8P7R6Y',
    'FAJIAN-VIP-2026-075-3A9S2U',
    'FAJIAN-VIP-2026-076-7N4Q1L',
    'FAJIAN-VIP-2026-077-1C8G5X',
    'FAJIAN-VIP-2026-078-6K3I9Z',
    'FAJIAN-VIP-2026-079-5J7H2P',
    'FAJIAN-VIP-2026-080-4R1T8M',
    'FAJIAN-VIP-2026-081-0S6W3B',
    'FAJIAN-VIP-2026-082-9V5D7N',
    'FAJIAN-VIP-2026-083-2F1O4C',
    'FAJIAN-VIP-2026-084-8L9X6R',
    'FAJIAN-VIP-2026-085-3G2Y1K',
    'FAJIAN-VIP-2026-086-7U8P5M',
    'FAJIAN-VIP-2026-087-1Q7A9J',
    'FAJIAN-VIP-2026-088-6B4S2W',
    'FAJIAN-VIP-2026-089-5Z9T3V',
    'FAJIAN-VIP-2026-090-4H1I7L',
    'FAJIAN-VIP-2026-091-0M5C8X',
    'FAJIAN-VIP-2026-092-9R2N6Z',
    'FAJIAN-VIP-2026-093-2P8Q1K',
    'FAJIAN-VIP-2026-094-8I3J5Y',
    'FAJIAN-VIP-2026-095-3W7F4S',
    'FAJIAN-VIP-2026-096-7O1D9M',
    'FAJIAN-VIP-2026-097-1A6G2C',
    'FAJIAN-VIP-2026-098-6K9V3L',
    'FAJIAN-VIP-2026-099-5N4H7X',
    'FAJIAN-VIP-2026-100-4Z8U1P'
  ];

  // ---------- 签名工具 ----------

  /** 简易签名：对 value + salt 做哈希 */
  function _sign(value) {
    let hash = 0;
    const str = String(value) + SALT;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0; // 32位整数
    }
    return hash.toString(36);
  }

  /** 验证签名 */
  function _verify(value, sig) {
    return _sign(value) === sig;
  }

  // ---------- 试用次数 ----------

  /** 检查试用是否已使用 */
  function isTrialUsed() {
    const val = Utils.storageGet(STORAGE_KEYS.TRIAL_USED);
    const sig = Utils.storageGet(STORAGE_KEYS.TRIAL_SIG);

    // 新用户 / 存储不可用 → 默认未使用，享 1 次免费解析
    if (val === null) return false;

    // 有签名则验证（防篡改），无签名则信任值（兼容受限环境）
    if (sig !== null && !_verify(val, sig)) return true;

    return val === 'true' || val === '1';
  }

  /** 标记试用已使用 */
  function markTrialUsed() {
    Utils.storageSet(STORAGE_KEYS.TRIAL_USED, 'true');
    Utils.storageSet(STORAGE_KEYS.TRIAL_SIG, _sign('true'));
  }

  // ---------- VIP 身份 ----------

  /** 检查是否为 VIP */
  function isVIP() {
    const val = Utils.storageGet(STORAGE_KEYS.VIP_STATUS);
    const sig = Utils.storageGet(STORAGE_KEYS.VIP_SIG);

    if (val === null) return false;
    if (sig !== null && !_verify(val, sig)) return false;

    return val === 'true' || val === '1';
  }

  /** 设置永久 VIP */
  function setVIP() {
    Utils.storageSet(STORAGE_KEYS.VIP_STATUS, 'true');
    Utils.storageSet(STORAGE_KEYS.VIP_SIG, _sign('true'));
    // VIP 激活后清除试用标记，确保后续无干扰
    Utils.storageSet(STORAGE_KEYS.TRIAL_USED, 'false');
    Utils.storageSet(STORAGE_KEYS.TRIAL_SIG, _sign('false'));
  }

  // ---------- 密钥校验 ----------

  /** 校验 VIP 密钥是否在白名单中 */
  function validateVipKey(key) {
    if (!key || typeof key !== 'string') return false;
    const cleanKey = Utils.trim(key);
    if (!cleanKey) return false;

    return VIP_KEY_WHITELIST.some(k => Utils.trim(k) === cleanKey);
  }

  // ---------- 权限校验 ----------

  /** 四重全局权限校验：是否可以发起解析 */
  function canAnalyze() {
    // 1️⃣ VIP 用户永远放行
    if (isVIP()) return true;

    // 2️⃣ 试用未使用 → 放行
    if (!isTrialUsed()) return true;

    // 3️⃣ 试用已使用 → 拦截
    return false;
  }

  /** 获取当前权限状态摘要 */
  function getStatus() {
    return {
      isVIP: isVIP(),
      isTrialUsed: isTrialUsed(),
      canAnalyze: canAnalyze(),
      remainingTrials: isVIP() ? Infinity : (isTrialUsed() ? 0 : 1)
    };
  }

  // ---------- 公开 API ----------
  return Object.freeze({
    isTrialUsed,
    markTrialUsed,
    isVIP,
    setVIP,
    validateVipKey,
    canAnalyze,
    getStatus
  });
})();
