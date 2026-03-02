// remove_shop_tab.js
// 作用：删除底部配置里所有 key 以 shop 开头的项（shop / shopSelected / shop_AN1...）

let obj = JSON.parse($response.body);

try {
  const list = obj?.configParentList || [];
  for (const parent of list) {
    const items = parent?.parentConfigItemList || [];
    for (const cfg of items) {
      if (
        cfg?.categoryID === "gj-bottom-tab-text" ||
        cfg?.categoryID === "gj-bottom-image-cfg"
      ) {
        const m = cfg.itemMap || {};
        for (const k of Object.keys(m)) {
          if (/^shop/.test(k)) delete m[k];
        }
        cfg.itemMap = m;
      }
    }
  }
} catch (e) {}

$done({ body: JSON.stringify(obj) });
