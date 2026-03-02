/*
 * 建行生活（yunbusiness.ccb.com）首页净化脚本
 * 适用：Loon http-response
 * 目标：
 *  - txcode=A3341AB03 / A3341AB05：清空首页广告/运营/推荐模块
 *  - 特别处理：WINNOW_V3_FESTIVAL（首页滚动推广图，如“龙积分充话费…”）
 *  - 清空“种草推荐”：PREFERENCE_AD_INFO 等
 */

(function () {
  const url = ($request && $request.url) ? $request.url : "";

  // 仅处理指定 txcode，避免误伤
  const hitTx = /txcode=A3341AB0(3|5)\b/i.test(url);
  if (!hitTx) {
    $done({ body: $response.body });
    return;
  }

  const body = $response.body || "";

  // 快速判断是否 JSON
  const trimmed = body.trim();
  const looksJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));

  if (!looksJson) {
    $done({ body });
    return;
  }

  // 你抓包里/常见首页运营位字段：存在于 obj.data 下
  // 这里尽量“只清运营位”，不动核心业务字段，降低误伤概率
  const moduleKeys = [
    // 你脚本里原本就有的 + 常见变体
    "TAG_AD_INFO",
    "TAG_AD_INFO0",
    "TAG_AD_INFO1",
    "TAG_AD_INFO2",
    "NOTICE_AD_INFO",
    "PREFERENCE_AD_INFO",           // 种草/推荐（重点）
    "HPBANNER_AD_INFO_SECOND",
    "HPBANNER_AD_INFO",
    "HPBANNER_AD_INFO0",
    "HPBANNER_AD_INFO1",
    "SECOND_AD_INFO",
    "SECOND_AD_INFO0",
    "SECOND_AD_INFO1",
    "AD_INFO",
    "AD_LIST",
    "BANNER",
    "BANNER_LIST",
    "BANNER_INFO",
    "POPUP_AD_INFO",
    "POP_AD_INFO",

    // 你这次反馈的：首页滚动推广图（重点）
    "WINNOW_V3_FESTIVAL",

    // 一些常见的运营/推荐位命名（尽量不碰业务数据）
    "WINNOW",
    "WINNOW_V3",
    "RECOMMEND",
    "RECOMMEND_INFO",
    "RECOMMEND_LIST",
    "MARKET",
    "MARKET_INFO",
    "MARKET_LIST",
    "ACTIVITY",
    "ACTIVITY_INFO",
    "ACTIVITY_LIST",
    "COUPON_AD_INFO",
    "COUPON_BANNER",
    "NOTICE_LIST",
  ];

  // 额外：按“字段名特征”清理（防止字段名变了）
  // 注意：只在 obj.data 范围内做，减少误伤
  function shouldRemoveByKeyName(key) {
    const k = String(key || "").toUpperCase();

    // 命中这些关键词，基本就是运营/推广位
    const hit =
      k.includes("PREFERENCE") ||   // 种草/偏好推荐
      k.includes("BANNER") ||
      k.includes("NOTICE") ||
      (k.includes("AD") && !["DATA", "RESULT"].includes(k)) ||
      k.includes("WINNOW") ||
      k.includes("RECOMM") ||
      k.includes("MARKET") ||
      k.includes("PROMO") ||
      k.includes("ACTIVITY");

    // 避免误伤特别基础字段
    const avoid =
      k === "DATA" ||
      k === "RESULT" ||
      k === "ERRCODE" ||
      k === "ERRMSG" ||
      k === "SYSTEM_TIME" ||
      k === "TXCODE";

    return hit && !avoid;
  }

  // 深度清理：移除广告对象（如果藏在数组里）
  function stripAdObjectsDeep(node) {
    if (!node) return node;

    if (Array.isArray(node)) {
      const arr = node
        .map(stripAdObjectsDeep)
        .filter((item) => {
          if (!item || typeof item !== "object") return true;

          // 广告对象常见字段：AD_URL / AD_IMG / AD_ID / SECOND_AD_TYPE 等
          const keys = Object.keys(item).map((x) => String(x).toUpperCase());
          const looksAdObj =
            keys.includes("AD_URL") ||
            keys.includes("AD_IMG") ||
            keys.includes("AD_ID") ||
            keys.includes("AD_NAME") ||
            keys.includes("SECOND_AD_TYPE") ||
            keys.includes("JUMP_URL") ||
            keys.includes("JUMPURL") ||
            keys.includes("CLICK_URL") ||
            keys.includes("CLICKURL");

          return !looksAdObj;
        });
      return arr;
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

    // 统一：只对 obj.data 动刀，最大限度减少误伤
    if (obj && typeof obj === "object" && obj.data && typeof obj.data === "object") {
      // 1) 精准删指定运营位字段
      for (const k of moduleKeys) {
        if (Object.prototype.hasOwnProperty.call(obj.data, k)) {
          delete obj.data[k];
        }
      }

      // 2) 按字段名特征兜底删除（防字段变体）
      for (const k of Object.keys(obj.data)) {
        if (shouldRemoveByKeyName(k)) {
          // 对数组/对象尽量直接清空；字符串/数字置空
          const v = obj.data[k];
          if (Array.isArray(v)) obj.data[k] = [];
          else if (v && typeof v === "object") obj.data[k] = {};
          else obj.data[k] = "";
        }
      }

      // 3) 深度剔除数组里夹带的广告对象
      obj.data = stripAdObjectsDeep(obj.data);
    }

    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    // 解析失败放行原响应，避免白屏
    $done({ body });
  }
})();
