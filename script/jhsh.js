/*
 * 建行生活首页净化（Loon http-response）
 * 适用接口：txcode=A3341AB03 / A3341AB05
 *
 * 保留：
 *  - FUNCTIONAL_AREA_AD_INFO   （顶部：扫一扫/付款码/建行生活卡/龙积分商城）
 *  - WINNOW_V3_MEB_GIFT        （中间：每日签到/好券中心/热门活动/财富会员）
 *  - NOTICE_AD_INFO            （公告栏：你没说要删，默认保留）
 *
 * 删除：
 *  - WINNOW_V3_FESTIVAL        （滚动大图：如“龙积分充话费 至高抵100元”）
 *  - PREFERENCE_AD_INFO        （种草/偏好推荐）
 *  - HPBANNER*                 （顶部大banner广告）
 *  - DAY_BEST_*                （种草推荐/精选推荐/热门话题等）
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

  // 你明确要保留的模块（避免误伤）
  const KEEP_KEYS = new Set([
    "FUNCTIONAL_AREA_AD_INFO",
    "WINNOW_V3_MEB_GIFT",
    "NOTICE_AD_INFO",
  ]);

  // 精准要干掉的字段（命中就删）
  const DELETE_KEYS = new Set([
    "WINNOW_V3_FESTIVAL",       // 滚动推广图（积分充话费…）
    "PREFERENCE_AD_INFO",       // 种草推荐
    "TAG_AD_INFO",
    "TAG_AD_INFO0",
    "TAG_AD_INFO1",
    "TAG_AD_INFO2",
  ]);

  function stripAdObjectsDeep(node) {
    if (!node) return node;

    if (Array.isArray(node)) {
      return node
        .map(stripAdObjectsDeep)
        .filter((item) => {
          if (!item || typeof item !== "object") return true;
          const keys = Object.keys(item).map((k) => String(k).toUpperCase());
          // 广告对象常见字段（谨慎，只过滤“明显广告对象”）
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
        out[k] = stripAdObjectsDeep(v);
      }
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

    // 1) 先删“明确黑名单”字段
    for (const k of Object.keys(data)) {
      if (KEEP_KEYS.has(k)) continue;

      // 精确命中
      if (DELETE_KEYS.has(k)) {
        delete data[k];
        continue;
      }

      // 规则命中：DAY_BEST_* 这类就是“种草推荐/精选推荐/热门话题”
      if (/^DAY_BEST_/i.test(k)) {
        delete data[k];
        continue;
      }

      // 规则命中：HPBANNER* 顶部大 banner 广告
      if (/^HPBANNER/i.test(k)) {
        delete data[k];
        continue;
      }
    }

    // 2) 再做一次深度清理：仅对“非保留模块”里的广告对象做剔除（避免影响你要保留的入口/四宫格）
    for (const k of Object.keys(data)) {
      if (KEEP_KEYS.has(k)) continue;
      data[k] = stripAdObjectsDeep(data[k]);
    }

    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    $done({ body });
  }
})();
