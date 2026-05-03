// ============================================================
// 法简AI - 权限鉴权模块
// 双重本地存储 + 签名防篡改 + 四重全局权限校验
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

  // ---------- 双向存储 ----------

  function _dualGet(key) {
    const lv = Utils.storageGet(key);
    const sv = Utils.sessionGet(key);
    // 任一存储返回非空有效值即采用
    return lv !== null ? lv : sv;
  }

  function _dualSet(key, value) {
    Utils.storageSet(key, value);
    Utils.sessionSet(key, value);
  }

  function _dualRemove(key) {
    Utils.storageRemove(key);
    Utils.sessionSet(key, ''); // sessionStorage 清空设空字符串
  }

  // ---------- 试用次数 ----------

  /** 检查试用是否已使用 */
  function isTrialUsed() {
    const val = _dualGet(STORAGE_KEYS.TRIAL_USED);
    const sig = _dualGet(STORAGE_KEYS.TRIAL_SIG);

    // 存储异常 / 不存在 / 签名不匹配 → 默认判定已用尽（兜底防白嫖）
    if (val === null || sig === null) return true;
    if (!_verify(val, sig)) return true;

    return val === 'true' || val === '1';
  }

  /** 标记试用已使用 */
  function markTrialUsed() {
    _dualSet(STORAGE_KEYS.TRIAL_USED, 'true');
    _dualSet(STORAGE_KEYS.TRIAL_SIG, _sign('true'));
  }

  // ---------- VIP 身份 ----------

  /** 检查是否为 VIP */
  function isVIP() {
    const val = _dualGet(STORAGE_KEYS.VIP_STATUS);
    const sig = _dualGet(STORAGE_KEYS.VIP_SIG);

    if (val === null || sig === null) return false;
    if (!_verify(val, sig)) return false;

    return val === 'true' || val === '1';
  }

  /** 设置永久 VIP */
  function setVIP() {
    _dualSet(STORAGE_KEYS.VIP_STATUS, 'true');
    _dualSet(STORAGE_KEYS.VIP_SIG, _sign('true'));
    // VIP 激活后清除试用标记，确保后续无干扰
    _dualSet(STORAGE_KEYS.TRIAL_USED, 'false');
    _dualSet(STORAGE_KEYS.TRIAL_SIG, _sign('false'));
  }

  // ---------- 密钥校验 ----------

  /** 校验 VIP 密钥是否在白名单中 */
  function validateVipKey(key) {
    if (!key || typeof key !== 'string') return false;
    const cleanKey = Utils.trim(key);
    if (!cleanKey) return false;

    const whitelist = Config.getVipKeyWhitelist();
    return whitelist.some(k => Utils.trim(k) === cleanKey);
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
