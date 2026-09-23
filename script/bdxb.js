// spdb_splash_size.js
// 浦大喜奔：按图片真实分辨率拦截开屏广告
// 仅拦截 1125 x 1931
// 支持 JPEG / PNG / GIF
// 其他分辨率、其他格式全部放行

const TARGET_WIDTH = 1125;
const TARGET_HEIGHT = 1931;

function toUint8Array(body) {
  if (body instanceof Uint8Array) return body;

  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }

  // 二进制图片正常情况下 Loon 会给 Uint8Array。
  // 如果拿到的是字符串，为避免误判，直接不处理。
  return null;
}

function readBE32(b, offset) {
  return (
    ((b[offset] << 24) >>> 0) +
    (b[offset + 1] << 16) +
    (b[offset + 2] << 8) +
    b[offset + 3]
  ) >>> 0;
}

function getPngSize(b) {
  // PNG signature
  if (
    b.length < 24 ||
    b[0] !== 0x89 ||
    b[1] !== 0x50 ||
    b[2] !== 0x4e ||
    b[3] !== 0x47 ||
    b[4] !== 0x0d ||
    b[5] !== 0x0a ||
    b[6] !== 0x1a ||
    b[7] !== 0x0a
  ) {
    return null;
  }

  return {
    type: "PNG",
    width: readBE32(b, 16),
    height: readBE32(b, 20)
  };
}

function getGifSize(b) {
  if (b.length < 10) return null;

  const isGif =
    b[0] === 0x47 && // G
    b[1] === 0x49 && // I
    b[2] === 0x46 && // F
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61;   // a

  if (!isGif) return null;

  return {
    type: "GIF",
    width: b[6] | (b[7] << 8),
    height: b[8] | (b[9] << 8)
  };
}

function getJpegSize(b) {
  if (
    b.length < 4 ||
    b[0] !== 0xff ||
    b[1] !== 0xd8
  ) {
    return null;
  }

  let pos = 2;

  while (pos + 8 < b.length) {
    // 找 marker
    if (b[pos] !== 0xff) {
      pos++;
      continue;
    }

    while (pos < b.length && b[pos] === 0xff) pos++;
    if (pos >= b.length) break;

    const marker = b[pos++];

    // 无长度字段的 marker
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7) ||
      marker === 0x01
    ) {
      continue;
    }

    if (pos + 1 >= b.length) break;

    const segmentLength = (b[pos] << 8) | b[pos + 1];

    if (segmentLength < 2 || pos + segmentLength > b.length) {
      break;
    }

    // SOF markers
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

    if (isSOF && segmentLength >= 7) {
      const height = (b[pos + 3] << 8) | b[pos + 4];
      const width  = (b[pos + 5] << 8) | b[pos + 6];

      return {
        type: "JPEG",
        width,
        height
      };
    }

    pos += segmentLength;
  }

  return null;
}

function getImageSize(b) {
  return getPngSize(b) ||
         getGifSize(b) ||
         getJpegSize(b);
}

try {
  const bytes = toUint8Array($response.body);

  if (!bytes) {
    console.log("[浦大喜奔] 非二进制响应，放行");
    $done({});
  } else {
    const info = getImageSize(bytes);

    if (!info) {
      console.log("[浦大喜奔] 未识别图片格式，放行");
      $done({});
    } else {
      console.log(
        `[浦大喜奔] ${info.type} ${info.width}x${info.height} ${$request.url}`
      );

      if (
        info.width === TARGET_WIDTH &&
        info.height === TARGET_HEIGHT
      ) {
        console.log(
          `[浦大喜奔] 命中开屏尺寸 ${TARGET_WIDTH}x${TARGET_HEIGHT}，拦截`
        );

        // 返回空内容，不把广告图片交给 App
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
        // 其他图片完全不修改
        $done({});
      }
    }
  }
} catch (e) {
  console.log(`[浦大喜奔] 脚本异常：${e}`);
  $done({});
}
