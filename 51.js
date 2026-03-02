// RemoveShopTab.js  (增强版：统计删除数量 + 更激进清理)
let obj = JSON.parse($response.body);

let removed = 0;

function walk(v) {
  if (!v) return;

  if (Array.isArray(v)) {
    // 顺便把数组里出现的 "shop" 干掉（如果存在 tabOrder/tabList 之类）
    for (let i = v.length - 1; i >= 0; i--) {
      const x = v[i];
      if (x === "shop") {
        v.splice(i, 1);
        removed++;
        continue;
      }
      walk(x);
    }
    return;
  }

  if (typeof v === "object") {
    for (const k of Object.keys(v)) {
      // 删除所有 shop* 键
      if (/^shop/.test(k)) {
        delete v[k];
        removed++;
        continue;
      }
      // 也顺便处理 value 直接就是“好物”的情况（极少数配置会这么写）
      if (v[k] === "好物") {
        v[k] = "";
        removed++;
      }
      walk(v[k]);
    }
  }
}

walk(obj);

console.log(`[RemoveShopTab] removed=${removed}`);

$done({ body: JSON.stringify(obj) });
