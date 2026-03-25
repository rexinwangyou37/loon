// 每日英语听力 / 欧路词典 开屏广告拦截
// 用法：Loon 里把这段脚本作为 http-response 脚本引用
// 作用：删除 EicoHomePage 返回中的 startpage 广告项，避免开屏广告继续被加载

function shouldRemoveNode(node) {
  if (!node || typeof node !== "object") return false;

  // 1) 直接命中 startpage 类型
  if (node.type === "startpage") return true;

  // 2) 任意字段里出现 /bg/startpage/ 就认为是开屏广告
  try {
    const text = JSON.stringify(node);
    if (/\/bg\/startpage\//i.test(text)) return true;
  } catch (e) {}

  // 3) 兼容某些字段名变化：image_url / source_url / image_url_night 等
  const keys = ["image_url", "image_url_origin", "image_url_thumbnail", "image_url_night", "source_url"];
  for (const k of keys) {
    const v = node[k];
    if (typeof v === "string" && /\/bg\/startpage\//i.test(v)) return true;
  }

  // 4) 常见 startpage 广告特征：classification=1 + display_time>0
  if (node.classification === 1 && Number(node.display_time || 0) > 0) return true;

  return false;
}

function walk(value) {
  if (Array.isArray(value)) {
    return value
      .filter(item => !shouldRemoveNode(item))
      .map(item => walk(item));
  }

  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // 如果这个字段本身就是广告数组，直接过滤
      if (k === "ads" && Array.isArray(v)) {
        out[k] = v.filter(item => !shouldRemoveNode(item)).map(item => walk(item));
        continue;
      }

      out[k] = walk(v);
    }
    return out;
  }

  return value;
}

let body = $response.body;
try {
  const obj = JSON.parse(body);
  const newObj = walk(obj);
  body = JSON.stringify(newObj);
} catch (e) {
  // 解析失败就原样返回，避免影响功能
}

$done({ body });
