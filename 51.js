// HideShopTab.js 让“好物”看不见：文字置空 + 图标改透明 + 也删 shop*（可留可删）

const transparentPNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XK2cAAAAASUVORK5CYII=";

let obj = JSON.parse($response.body);

try {
  const list = obj?.configParentList || [];
  for (const parent of list) {
    const items = parent?.parentConfigItemList || [];
    for (const cfg of items) {
      if (!cfg?.itemMap) continue;

      // 1) 文案：把 shop 文案置空
      if (cfg.categoryID === "gj-bottom-tab-text") {
        if ("shop" in cfg.itemMap) cfg.itemMap.shop = "";
      }

      // 2) 图标：把 shop / shopSelected / shop_AN* 全部指向透明图
      if (cfg.categoryID === "gj-bottom-image-cfg") {
        for (const k of Object.keys(cfg.itemMap)) {
          if (/^shop/.test(k)) cfg.itemMap[k] = transparentPNG;
        }
      }

      // 3) 可选：顺手删掉 shop*（你之前逻辑保留也行）
      // for (const k of Object.keys(cfg.itemMap)) {
      //   if (/^shop/.test(k)) delete cfg.itemMap[k];
      // }
    }
  }
} catch (e) {}

$done({ body: JSON.stringify(obj) });
