/*
 * 建行生活净化（Loon http-response）
 * 覆盖：yunbusiness.ccb.com/(basic_service|clp_service)/txCtrl?txcode=A3341ABxx
 *
 * 目标：
 *  - 保留：FUNCTIONAL_AREA_AD_INFO / WINNOW_V3_MEB_GIFT / NOTICE_AD_INFO
 *  - 去除：WINNOW_V3_FESTIVAL / HPBANNER* / DAY_BEST_* / PREFERENCE_AD_INFO 等
 *  - 楼层开关：STOREY_DISPLAY_INFO 里强制移除
 *      本地优惠(273) + 种草推荐(274) + 小编推荐 + 分期好生活
 */

(function () {
  const body = $response.body || "";
  const t = body.trim();
  const looksJson =
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"));
  if (!looksJson) return $done({ body });

  const KEEP_KEYS = new Set([
    "FUNCTIONAL_AREA_AD_INFO", // 顶部4入口
    "WINNOW_V3_MEB_GIFT",      // 中间4卡
    "NOTICE_AD_INFO",
  ]);

  const DELETE_EXACT_KEYS = new Set([
    "WINNOW_V3_FESTIVAL",          // 滚动推广图
    "PREFERENCE_AD_INFO",          // 种草/推荐流（直接整块删）
    "HPBANNER_AD_INFO_SECOND",     // 横幅
    "HPBANNER_AD_INFO",
    "HPBANNER_AD_INFO_FIRST",
    "HPBANNER_AD_INFO_THIRD",
    "TAG_AD_INFO",
    "TAG_AD_INFO0",
    "TAG_AD_INFO1",
    "TAG_AD_INFO2",
  ]);

  // 楼层开关：强制删除的 STOREY_TYPE（你抓到的：273 本地优惠、274 种草推荐）
  const BAN_STOREY_TYPES = new Set(["273", 273, "274", 274]);

  // 楼层开关：强制删除的中文关键词（防止 TYPE 变动/不一致）
  const BAN_STOREY_NAME_RE = /(本地优惠|种草推荐|小编推荐|分期好生活)/;

  function shouldDeleteKeyByName(k) {
    const key = String(k || "").toUpperCase();
    if (key.startsWith("DAY_BEST_")) return true; // 精选推荐/热门话题等
    if (key.startsWith("HPBANNER")) return true;  // 顶部横幅/大banner
    if (key.includes("PREFERENCE_AD")) return true;
    // 本地优惠类字段名（仅匹配明确前缀，避免误伤）
    if (key.startsWith("LOCAL_") || key.startsWith("NEARBY_") || key.startsWith("AROUND_")) return true;
    if (key.includes("LOCAL_BENEFIT") || key.includes("NEARBY_BENEFIT")) return true;
    return false;
  }

  try {
    const obj = JSON.parse(body);
    const data = obj?.data;
    if (!data || typeof data !== "object") return $done({ body });

    // A) 楼层开关：把本地优惠/种草推荐等楼层从“显示列表”里移除
    if (Array.isArray(data.STOREY_DISPLAY_INFO)) {
      data.STOREY_DISPLAY_INFO = data.STOREY_DISPLAY_INFO.filter((it) => {
        const type = it?.STOREY_TYPE;
        const nm = String(it?.STOREY_NM || it?.STOREY_TITLE || "");
        if (BAN_STOREY_TYPES.has(type)) return false;
        if (BAN_STOREY_NAME_RE.test(nm)) return false;
        return true;
      });
    }

    // B) 删除 data 下的广告位字段（白名单保留）
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

    return $done({ body: JSON.stringify(obj) });
  } catch (e) {
    return $done({ body });
  }
})();
