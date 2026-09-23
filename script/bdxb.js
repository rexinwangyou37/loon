// 浦大喜奔开屏广告：按真实图片分辨率拦截
// 目标：1125 x 1931
// 支持 JPEG / PNG / GIF
// 配合 Loon binary-body-mode=true 使用

const TARGET_W = 1125;
const TARGET_H = 1931;

function be32(b, p) {
  return (
    ((b[p] << 24) >>> 0) |
    (b[p + 1] << 16) |
    (b[p + 2] << 8) |
    b[p + 3]
  ) >>> 0;
}

// PNG
function getPNG(b) {
  if (
    b.length >= 24 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return {
      type: "PNG",
      width: be32(b, 16),
      height: be32(b, 20)
    };
  }
  return null;
}

// GIF87a / GIF89a
function getGIF(b) {
  if (
    b.length >= 10 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return {
      type: "GIF",
      width: b[6] | (b[7] << 8),
      height: b[8] | (b[9] << 8)
    };
  }
  return null;
}

// JPEG
function getJPEG(b) {
  if (
    b.length < 4 ||
    b[0] !== 0xff ||
    b[1] !== 0xd8
  ) {
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

    // 不带长度的 marker
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

    if (len < 2 || p + len > b.length) break;

    const isSOF =
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

    if (isSOF && len >= 7) {
      return {
        type: "JPEG",
        height: (b[p + 3] << 8) | b[p + 4],
        width: (b[p + 5] << 8) | b[p + 6]
      };
    }

    p += len;
  }

  return null;
}

try {
  console.log("[SPDB] 脚本进入");
  console.log("[SPDB] URL = " + $request.url);

  const b = $response.body;

  console.log(
    "[SPDB] Body类型 = " +
    Object.prototype.toString.call(b)
  );

  if (!(b instanceof Uint8Array)) {
    console.log("[SPDB] ❌ Body不是Uint8Array，不处理");
    $done({});
  } else {
    console.log("[SPDB] Body大小 = " + b.length + " bytes");

    const info =
      getPNG(b) ||
      getGIF(b) ||
      getJPEG(b);

    if (!info) {
      console.log("[SPDB] 未识别图片格式 → 放行");
      $done({});
    } else {
      console.log(
        `[SPDB] ${info.type} ${info.width}x${info.height}`
      );

      if (
        info.width === TARGET_W &&
        info.height === TARGET_H
      ) {
        console.log(
          `[SPDB] ★ 命中开屏广告 ${TARGET_W}x${TARGET_H} → 拦截`
        );

        $done({
          response: {
            status: 204,
            headers: {
              "Content-Length": "0"
            },
            body: ""
          }
        });
      } else {
        console.log(
          `[SPDB] 非目标尺寸 ${info.width}x${info.height} → 放行`
        );

        $done({});
      }
    }
  }
} catch (e) {
  console.log("[SPDB] ERROR = " + e);
  $done({});
}
