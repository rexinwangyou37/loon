// 浦大喜奔开屏广告尺寸拦截
// 脚本地址：
// https://raw.githubusercontent.com/rexinwangyou37/loon/refs/heads/main/script/bdxb.js
//
// 功能：
// 1. 支持 JPEG / JPG / PNG / GIF
// 2. 读取图片真实分辨率
// 3. 仅处理 1125 x 1931 的开屏广告
// 4. 其他分辨率图片全部原样放行
// 5. 必须配合 binary-body-mode=true 使用

const TARGET_WIDTH = 1125;
const TARGET_HEIGHT = 1931;


// ==============================
// 工具函数
// ==============================

function readBE32(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}


// ==============================
// PNG
// ==============================

function getPNGSize(bytes) {
  if (bytes.length < 24) return null;

  const isPNG =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  if (!isPNG) return null;

  return {
    type: "PNG",
    width: readBE32(bytes, 16),
    height: readBE32(bytes, 20)
  };
}


// ==============================
// GIF
// ==============================

function getGIFSize(bytes) {
  if (bytes.length < 10) return null;

  const isGIF =
    bytes[0] === 0x47 && // G
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61;

  if (!isGIF) return null;

  return {
    type: "GIF",
    width: bytes[6] | (bytes[7] << 8),
    height: bytes[8] | (bytes[9] << 8)
  };
}


// ==============================
// JPEG / JPG
// ==============================

function getJPEGSize(bytes) {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  ) {
    return null;
  }

  let pos = 2;

  while (pos + 8 < bytes.length) {

    if (bytes[pos] !== 0xff) {
      pos++;
      continue;
    }

    while (
      pos < bytes.length &&
      bytes[pos] === 0xff
    ) {
      pos++;
    }

    if (pos >= bytes.length) break;

    const marker = bytes[pos++];

    // 没有长度字段的 JPEG Marker
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }

    if (pos + 1 >= bytes.length) break;

    const segmentLength =
      (bytes[pos] << 8) |
      bytes[pos + 1];

    if (
      segmentLength < 2 ||
      pos + segmentLength > bytes.length
    ) {
      break;
    }

    // SOF Marker
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

      const height =
        (bytes[pos + 3] << 8) |
        bytes[pos + 4];

      const width =
        (bytes[pos + 5] << 8) |
        bytes[pos + 6];

      return {
        type: "JPEG",
        width: width,
        height: height
      };
    }

    pos += segmentLength;
  }

  return null;
}


// ==============================
// 主逻辑
// ==============================

try {

  console.log("[SPDB] 脚本进入");
  console.log("[SPDB] URL = " + $request.url);

  const body = $response.body;

  console.log(
    "[SPDB] Body类型 = " +
    Object.prototype.toString.call(body)
  );

  // binary-body-mode=true 后应该是 Uint8Array
  if (!(body instanceof Uint8Array)) {

    console.log(
      "[SPDB] ❌ Body不是Uint8Array，不处理"
    );

    $done({});

  } else {

    console.log(
      "[SPDB] Body大小 = " +
      body.length +
      " bytes"
    );

    const info =
      getPNGSize(body) ||
      getGIFSize(body) ||
      getJPEGSize(body);

    // 无法识别的内容全部放行
    if (!info) {

      console.log(
        "[SPDB] 未识别图片格式 → 放行"
      );

      $done({});

    } else {

      console.log(
        "[SPDB] " +
        info.type +
        " " +
        info.width +
        "x" +
        info.height
      );

      // ==========================
      // 只拦截 1125 x 1931
      // ==========================

      if (
        info.width === TARGET_WIDTH &&
        info.height === TARGET_HEIGHT
      ) {

        console.log(
          "[SPDB] ★ 命中开屏广告 " +
          TARGET_WIDTH +
          "x" +
          TARGET_HEIGHT +
          " → 拦截"
        );

        // 返回空响应
        // 避免把原始广告图片交给 APP
        $done({
          response: {
            status: 204,
            headers: {
              "Content-Length": "0",
              "Cache-Control": "no-store"
            },
            body: ""
          }
        });

      } else {

        // 其他所有图片完全放行

        console.log(
          "[SPDB] 非目标尺寸 " +
          info.width +
          "x" +
          info.height +
          " → 放行"
        );

        $done({});
      }
    }
  }

} catch (error) {

  console.log(
    "[SPDB] ❌ ERROR = " +
    error
  );

  // 出错时默认放行，避免影响 APP 正常图片
  $done({});
}
