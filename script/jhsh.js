/*
 * 建行生活净化（Loon http-response）
 * 覆盖：yunbusiness.ccb.com/(basic_service|clp_service)/txCtrl?txcode=A3341ABxx
 *
 * 重点增强：
 *  - STOREY_DISPLAY_INFO：强制删除 STOREY_TYPE=273（本地优惠），并按字段名包含“本地优惠”兜底
 *  - 深度过滤：数组元素里若出现“本地优惠”字样（AD_NAME/STOREY_NM/STOREY_TITLE/NAME/TITLE），剔除该元素
 *  - 白名单保留：FUNCTIONAL_AREA_AD_INFO / WINNOW_V3_MEB_GIFT / NOTICE_AD_INFO
 */

(function () {
  const body = $response.body || "";
  const t = body.trim();
  const looksJson =
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"));

  if (!looksJson) return $done({ body });

  // 白名单：你要保留的模块
  const KEEP_KEYS = new Set([
    "FUNCTIONAL_AREA_AD_INFO", // 扫一扫/付款码/建行生活卡/龙积分商城
    "WINNOW_V3_MEB_GIFT",      // 每日签到/好券中心/热门活动/财富会员
    "NOTICE_AD_INFO",
  ]);

  // 明确删除的广告位字段
  const DELETE_EXACT_KEYS = new Set([
    "WINNOW_V3_FESTIVAL",
    "PREFERENCE_AD_INFO",
    "HPBANNER_AD_INFO_SECOND",
    "HPBANNER_AD_INFO",
    "HPBANNER_AD_INFO_FIRST",
    "HPBANNER_AD_INFO_THIRD",
    "TAG_AD_INFO",
    "TAG_AD_INFO0",
    "TAG_AD_INFO1",
    "TAG_AD_INFO2",
  ]);

  // 本地优惠楼层类型（你抓包里就是 273）
  const BAN_STOREY_TYPES = new Set(["273", 273]);

  // 判定：对象是否“本地优惠相关”
  function isLocalBenefitObject(obj) {
    if (!obj || typeof obj !== "object") return false;

    // 1) 楼层类型强判
    if (BAN_STOREY_TYPES.has(obj.STOREY_TYPE)) return true;

    // 2) 常见字段文本包含
    const fields = ["STOREY_NM", "STOREY_TITLE", "AD_NAME", "TITLE", "NAME", "DESC", "DESCRIPTION"];
    for (const f of fields) {
      if (obj[f] != null && String(obj[f]).includes("本地优惠")) return true;
    }
    return false;
  }

  // 字段名规则：删除典型信息流/广告位字段（谨慎）
  function shouldDeleteKeyByName(k) {
    const key = String(k || "").toUpperCase();

    if (key.startsWith("DAY_BEST_")) return true;
    if (key.startsWith("HPBANNER")) return true;
    if (key.includes("PREFERENCE_AD")) return true;

    // 只删“明确像本地优惠楼层/列表”的字段名（不做泛匹配）
    if (key.includes("LOCAL_BENEFIT") || key.includes("NEARBY_BENEFIT")) return true;
    if (key.startsWith("LOCAL_") || key.startsWith("NEARBY_") || key.startsWith("AROUND_")) return true;

    return false;
  }

  // 深度过滤：在数组里剔除“本地优惠对象”与“明显广告对象”
  function deepFilter(node, topKey) {
    if (!node) return node;

    if (Array.isArray(node)) {
      return node
        .map((x) => deepFilter(x, topKey))
        .filter((item) => {
          if (!item) return false;
          if (typeof item !== "object") return true;

          // 白名单模块不做本地优惠过滤（避免误伤你要保留的入口/会员有礼）
          if (KEEP_KEYS.has(topKey)) return true;

          // 先剔除“本地优惠”
          if (isLocalBenefitObject(item)) return false;

          // 再剔除“明显广告对象”（保守）
          const keys = Object.keys(item).map((k) => String(k).toUpperCase());
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
      for (const [k, v] of Object.entries(node)) {
        out[k] = deepFilter(v, topKey);
      }
      return out;
    }

    return node;
  }

  try {
    const obj = JSON.parse(body);
    const data = obj?.data;
    if (!data || typeof data !== "object") return $done({ body });

    // A) 处理楼层开关：STOREY_DISPLAY_INFO（强制去掉 STOREY_TYPE=273 + 名称含本地优惠）
    if (Array.isArray(data.STOREY_DISPLAY_INFO)) {
      data.STOREY_DISPLAY_INFO = data.STOREY_DISPLAY_INFO.filter((it) => !isLocalBenefitObject(it));
    }

    // B) 删除 data 下的广告位字段（保留白名单）
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

    // C) 深度过滤（把残余“本地优惠”对象从数组里剔除）
    for (const k of Object.keys(data)) {
      data[k] = deepFilter(data[k], k);
    }

    return $done({ body: JSON.stringify(obj) });
  } catch (e) {
    return $done({ body });
  }
})();
