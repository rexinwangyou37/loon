/*
 * 建行生活净化（Loon http-response）
 * 覆盖 txcode：
 *  - A3341AB03 / A3341AB05：清内容模块（保留必要入口）
 *  - A3341AB08：清“楼层显示开关”（把精选-本地优惠/种草推荐从楼层列表移除）
 */

(function () {
  const url = ($request && $request.url) ? $request.url : "";
  const body = $response.body || "";
  const t = body.trim();

  const looksJson =
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"));

  if (!looksJson) return $done({ body });

  // ====== 1) AB08：楼层显示开关（你这次抓到的关键）======
  if (/txcode=A3341AB08\b/i.test(url)) {
    try {
      const obj = JSON.parse(body);
      const list = obj?.data?.STOREY_DISPLAY_INFO;

      if (Array.isArray(list)) {
        // 你要干掉的两块：
        // 273 = 精选-本地优惠
        // 274 = 精选-种草推荐
        const BAN_TYPES = new Set(["273", "274", 273, 274]);

        obj.data.STOREY_DISPLAY_INFO = list
          .filter(item => item && !BAN_TYPES.has(item.STOREY_TYPE))
          // 双保险：有些可能 STOREY_TYPE 不同但名字相同
          .filter(item => {
            const nm = String(item?.STOREY_NM || "");
            return !(nm.includes("本地优惠") || nm.includes("种草推荐"));
          });

        return $done({ body: JSON.stringify(obj) });
      }

      return $done({ body });
    } catch (e) {
      return $done({ body });
    }
  }

  // ====== 2) AB03 / AB05：内容模块净化（你之前那套逻辑）======
  if (!/txcode=A3341AB0(3|5)\b/i.test(url)) {
    return $done({ body });
  }

  // 白名单：你明确要保留的两个模块 + 公告
  const KEEP_KEYS = new Set([
    "FUNCTIONAL_AREA_AD_INFO",  // 顶部：扫一扫/付款码/建行生活卡/龙积分商城
    "WINNOW_V3_MEB_GIFT",       // 中间：每日签到/好券中心/热门活动/财富会员
    "NOTICE_AD_INFO",
  ]);

  // 精准删除的 key（只删这些，避免“删太多”）
  const DELETE_KEYS = new Set([
    "WINNOW_V3_FESTIVAL",       // 首页滚动推广图
    "PREFERENCE_AD_INFO",       // 种草推荐（如果内容从这里出）
    "TAG_AD_INFO",
    "TAG_AD_INFO0",
    "TAG_AD_INFO1",
    "TAG_AD_INFO2",
  ]);

  try {
    const obj = JSON.parse(body);
    const data = obj?.data;
    if (!data || typeof data !== "object") return $done({ body });

    for (const k of Object.keys(data)) {
      if (KEEP_KEYS.has(k)) continue;

      if (DELETE_KEYS.has(k)) {
        delete data[k];
        continue;
      }

      // 常见：精选推荐/热门话题等
      if (/^DAY_BEST_/i.test(k)) {
        delete data[k];
        continue;
      }

      // 顶部 banner（你不想要的话就删；如果你想保留可注释掉）
      if (/^HPBANNER/i.test(k)) {
        delete data[k];
        continue;
      }

      // 本地优惠（内容从这些字段出时）
      if (/^(LOCAL|NEARBY|AROUND)_/i.test(k)) {
        delete data[k];
        continue;
      }
    }

    return $done({ body: JSON.stringify(obj) });
  } catch (e) {
    return $done({ body });
  }
})();
