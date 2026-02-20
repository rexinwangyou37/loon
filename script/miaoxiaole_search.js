try {
  const obj = JSON.parse($response.body);
  console.log("before:", $response.body);

  obj.result = true;

  const out = JSON.stringify(obj);
  console.log("after:", out);

  $done({ body: out });
} catch (e) {
  console.log("parse error:", e);
  $done({});
}
