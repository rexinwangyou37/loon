// 浦大喜奔图片尺寸检测 - 诊断版
// 只检测、只打印日志，不拦截任何图片

function be32(b, p) {
  return (
    ((b[p] << 24) >>> 0) +
    (b[p + 1] << 16) +
    (b[p + 2] << 8) +
    b[p + 3]
  ) >>> 0;
}

function png(b) {
  if (
    b.length >= 24 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  ) {
    return {
      type: "PNG",
      width: be32(b, 16),
      height: be32(b, 20)
    };
  }
  return null;
}

function gif(b) {
  if (
    b.length >= 10 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46
  ) {
    return {
      type: "GIF",
      width: b[6] | (b[7] << 8),
      height: b[8] | (b[9] << 8)
    };
  }
  return null;
}

function jpeg(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) {
    return null;
  }

  let p = 2;

  while (p + 8 < b.length) {
    if (b[p] !== 0xff) {
      p++;
      continue;
    }

    while (p < b.length && b[p] === 0xff) p++;
    if (p >= b.length) break;

    const marker = b[p++];

    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }

    if (p + 1 >= b.length) break;

    const len = (b[p] << 8) | b[p + 1];

    const sof =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf;

    if (sof && len >= 7) {
      return {
        type: "JPEG",
        height: (b[p + 3] << 8) | b[p + 4],
        width: (b[p + 5] << 8) | b[p + 6]
      };
    }

    if (len < 2) break;
    p += len;
  }

  return null;
}

try {
  console.log("[SPDB] 脚本已进入");
  console.log("[SPDB] URL = " + $request.url);

  const body = $response.body;

  if (!(body instanceof Uint8Array)) {
    console.log(
      "[SPDB] Body不是Uint8Array，类型=" +
      typeof body
    );
    $done({});
  } else {
    console.log("[SPDB] Body大小=" + body.length + " bytes");

    const info = png(body) || gif(body) || jpeg(body);

    if (!info) {
      console.log("[SPDB] 未识别图片格式");
    } else {
      console.log(
        "[SPDB] 图片=" +
        info.type +
        " " +
        info.width +
        "x" +
        info.height
      );

      if (info.width === 1125 && info.height === 1931) {
        console.log(
          "[SPDB] ★★★ 命中目标开屏尺寸 1125x1931 ★★★"
        );
      }
    }

    // 诊断阶段全部放行
    $done({});
  }
} catch (e) {
  console.log("[SPDB] ERROR = " + e);
  $done({});
}
