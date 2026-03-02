/* 
 * 建行生活净化（Loon http-response）
 * 覆盖：yunbusiness.ccb.com/(basic_service|clp_service)/txCtrl?txcode=A3341ABxx
 *
 * 目标：
 * 1) 清内容广告字段（来自你提供的抓包文件：WINNOW_V3_FESTIVAL / HPBANNER / DAY_BEST_* / PREFERENCE 等）
 * 2) 清楼层开关（STOREY_DISPLAY_INFO）：移除 本地优惠/种草推荐/小编推荐/分期好生活
 * 3) 白名单保留：
 *    - FUNCTIONAL_AREA_AD_INFO（顶部4入口：扫一扫/付款码/建行生活卡/龙积分商城）
 *    - WINNOW_V3_MEB_GIFT（中间4卡：每日签到/好券中心/热门活动/财富会员）
 */

(function () {
  const body = $response.body || "";
  const t = body.trim();
  const looksJson =
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"));

  if (!looksJson) return $done({ body });

  // ——你要保留的模块（坚决不动）——
  const KEEP_KEYS = new Set([
    "FUNCTIONAL_AREA_AD_INFO",
    "WINNOW_V3_MEB_GIFT",
    "NOTICE_AD_INFO", // 公告默认保留（你没要求删）
  ]);

  // ——明确广告字段（来自你文件+常见变体）——
  const DELETE_EXACT_KEYS = new Set([
    "WINNOW_V3_FESTIVAL",          // 滚动推广图（积分充话费…）
    "PREFERENCE_AD_INFO",          // 种草/推荐流（文件里存在）
    "HPBANNER_AD_INFO_SECOND",     // 横幅（文件里存在）
    "HPBANNER_AD_INFO",
    "HPBANNER_AD_INFO_FIRST",
    "HPBANNER_AD_INFO_THIRD",
    "TAG_AD_INFO",
    "TAG_AD_INFO0",
    "TAG_AD_INFO1",
    "TAG_AD_INFO2",
  ]);

  // ——楼层开关：要移除的楼层关键词（你要求删）——
  const BAN_STOREY_NAME_PAT = /(本地优惠|种草推荐|小编推荐|分期好生活)/;

  // ✅ 新增：本地优惠楼层 TYPE（你抓到的是 273）
  const BAN_STOREY_TYPES = new Set(["273", 273]);

  // ——内容广告：字段名规则（谨慎，只打常见“广告位字段”，不做“凡带AD就删”的粗暴策略）——
  function shouldDeleteKeyByName(k) {
    const key = String(k || "").toUpperCase();

    // 精选/信息流常见
    if (key.startsWith("DAY_BEST_")) return true; // DAY_BEST_AD_FIRST/SECOND/THIRD/FOURTH...
    if (key.startsWith("HPBANNER")) return true;  // HPBANNER*
    if (key.includes("PREFERENCE_AD")) return true;

    // 生活/本地优惠常见（仅匹配较明确的“楼层/广告位”命名，避免误伤业务）
    if (key.includes("LOCAL_BENEFIT") || key.includes("NEARBY_BENEFIT")) return true;
    if (key.startsWith("LOCAL_") || key.startsWith("NEARBY_") || key.startsWith("AROUND_")) return true;

    return false;
  }

  // ——深度剔除：只剔除“明显广告对象”（减少误伤）——
  function stripAdObjectsDeep(node) {
    if (!node) return node;

    if (Array.isArray(node)) {
      return node
        .map(stripAdObjectsDeep)
        .filter((item) => {
          if (!item || typeof item !== "object") return true;
          const keys = Object.keys(item).map((x) => String(x).toUpperCase());
          // 广告对象典型字段
          const looksAdObj =
            keys.includes("AD_URL") ||
            keys.includes("AD_IMG") ||
            keys.includes("AD_ID") ||
            keys.includes("SECOND_AD_TYPE");
          return !looksAdObj;
        });
    }

    if (typeof node === "object") {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = stripAdObjectsDeep(v);
      return out;
    }

    return node;
  }

  // ✅ 新增：仅针对“本地优惠”的轻量过滤（不改原有广告过滤）
  function removeLocalBenefitItems(node) {
    if (!node) return node;

    if (Array.isArray(node)) {
      return node.filter((it) => {
        if (!it || typeof it !== "object") return true;
        // 只按常见字段判定，不做泛匹配，避免误伤
        const nm = String(it.STOREY_NM || it.STOREY_TITLE || it.AD_NAME || "");
        return !nm.includes("本地优惠");
      });
    }

    if (typeof node === "object") {
      // 只递归处理对象里的数组/子对象（轻量）
      for (const k of Object.keys(node)) {
        node[k] = removeLocalBenefitItems(node[k]);
      }
      return node;
    }

    return node;
  }

  try {
    const obj = JSON.parse(body);
    const data = obj?.data;

    if (!data || typeof data !== "object") return $done({ body });

    // 1) 如果存在 STOREY_DISPLAY_INFO（如你抓到的 AB08），按楼层名移除
    // ✅ 新增：同时按 STOREY_TYPE=273 强制移除（本地优惠最稳）
    if (Array.isArray(data.STOREY_DISPLAY_INFO)) {
      data.STOREY_DISPLAY_INFO = data.STOREY_DISPLAY_INFO.filter((it) => {
        const nm = String(it?.STOREY_NM || it?.STOREY_TITLE || "");
        if (BAN_STOREY_NAME_PAT.test(nm)) return false;          // 原逻辑不动
        if (BAN_STOREY_TYPES.has(it?.STOREY_TYPE)) return false; // ✅ 新增：强杀 273
        return true;
      });
    }

    // 2) 删除 data 下的广告位字段（保留白名单）
    for (const k of Object.keys(data)) {
      if (KEEP_KEYS.has(k)) continue;

      if (DELETE_EXACT_KEYS.has(k)) {
        delete data[k];
        continue;
      }

      if (shouldDeleteKeyByName(k)) {
        delete data[k];
        continue;
      }
    }

    // 3) 深度剔除：对非白名单模块做“明显广告对象”过滤（原逻辑不动）
    for (const k of Object.keys(data)) {
      if (KEEP_KEYS.has(k)) continue;
      data[k] = stripAdObjectsDeep(data[k]);
    }

    // ✅ 新增：最后再做一次“只删本地优惠”的轻量清理（不会影响你保留的两块）
    for (const k of Object.keys(data)) {
      if (KEEP_KEYS.has(k)) continue;
      data[k] = removeLocalBenefitItems(data[k]);
    }

    return $done({ body: JSON.stringify(obj) });
  } catch (e) {
    return $done({ body });
  }
})();
