// 猫小乐：解锁在线搜索权限
try {
  const obj = JSON.parse($response.body);

  // 按你的目标：把 result 强制改为 true
  obj.result = true;

  $done({ body: JSON.stringify(obj) });
} catch (e) {
  // 如果不是 JSON 或解析失败，就原样放行，避免崩
  $done({});
}
