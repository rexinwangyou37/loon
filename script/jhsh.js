/*
 * 建行生活首页净化（Loon http-response）
 * 适用接口：txcode=A3341AB03 / A3341AB05
 *
 * 保留（白名单）：
 *  - FUNCTIONAL_AREA_AD_INFO   （顶部：扫一扫/付款码/建行生活卡/龙积分商城）
 *  - WINNOW_V3_MEB_GIFT        （中间：每日签到/好券中心/热门活动/财富会员）
 *  - NOTICE_AD_INFO            （公告栏：默认保留）
 *
 * 删除（黑名单+规则）：
 *  - WINNOW_V3_FESTIVAL        （滚动大图：如“龙积分充话费 至高抵100元”）
 *  - PREFERENCE_AD_INFO        （种草/偏好推荐）
 *  - HPBANNER*                 （顶部大banner）
 *  - DAY_BEST_*                （精选推荐/热门话题/种草模块常见）
 *  - LOCAL_* / NEARBY_* / AROUND_* （生活页本地优惠/附近）
 *  - key 含 GRASS/PLANT/SEED/FEED/INFOFLOW （种草/信息流变体兜底）
 */

(function () {
  const url = ($request && $request.url) ? $request.url : "";
  if (!/txcode=A3341AB0(3|5)\b/i.test(url)) {
    $done({ body: $response.body });
    return;
  }

  const body = $response.body || "";
  const t = body.trim();
  const looksJson =
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"));
  if (!looksJson) {
    $done({ body });
    return;
  }

  const KEEP_KEYS = new Set([
    "FUNCTIONAL_AREA_AD_INFO",
    "WINNOW_V3_MEB_GIFT",
    "NOTICE_AD_INFO",
  ]);

  const DELETE_KEYS = new Set([
    "WINNOW_V3_FESTIVAL",
    "PREFERENCE_AD_INFO",
    "TAG_AD_INFO",
    "TAG_AD_INFO0",
    "TAG_AD_INFO1",
    "TAG_AD_INFO2",
  ]);

  // 字段名规则：用于删“本地优惠/附近”和“种草信息流”变体
  function shouldDeleteByKeyName(key) {
    const k = String(key || "").toUpperCase();

    // 本地优惠/附近（你要求：生活栏目都删本地优惠）
    if (/^(LOCAL|NEARBY|AROUND)_/.test(k)) return true;
    if (k.includes("LOCAL_BENEFIT") || k.includes("LOCAL_PRIV") || k.includes("NEARBY")) return true;

    // 种草/信息流/精选推荐 常见命名变体兜底
    if (k.includes("GRASS") || k.includes("PLANT") || k.includes("SEED") || k.includes("FEED") || k.includes("INFOFLOW")) return true;

    // 其它已知模块
    if (/^DAY_BEST_/.test(k)) return true;
    if (/^HPBANNER/.test(k)) return true;

    return false;
  }

  // 深度剔除：数组里夹带的“明显广告对象”
  function stripAdObjectsDeep(node) {
    if (!node) return node;

    if (Array.isArray(node)) {
      return node
        .map(stripAdObjectsDeep)
        .filter((item) => {
          if (!item || typeof item !== "object") return true;
          const keys = Object.keys(item).map((x) => String(x).toUpperCase());
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

  try {
    const obj = JSON.parse(body);
    if (!obj || typeof obj !== "object" || !obj.data || typeof obj.data !== "object") {
      $done({ body });
      return;
    }

    const data = obj.data;

    // 1) 删除顶层模块字段（只在 data 下动刀）
    for (const k of Object.keys(data)) {
      if (KEEP_KEYS.has(k)) continue;

      if (DELETE_KEYS.has(k)) {
        delete data[k];
        continue;
      }

      if (shouldDeleteByKeyName(k)) {
        delete data[k];
        continue;
      }
    }

    // 2) 深度剔除（只对非白名单模块）
    for (const k of Object.keys(data)) {
      if (KEEP_KEYS.has(k)) continue;
      data[k] = stripAdObjectsDeep(data[k]);
    }

    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    $done({ body });
  }
})();
