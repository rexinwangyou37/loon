/*
 * 收钱吧开屏广告 - 多图片格式尺寸识别版
 * 支持 JPEG / PNG / WebP / GIF
 * 不依赖 URL 后缀
 */

function getBytes() {
    let body = null;

    // 优先尝试二进制 Body
    if (typeof $response.bodyBytes !== "undefined" && $response.bodyBytes) {
        body = $response.bodyBytes;
    } else if (typeof $response.body !== "undefined") {
        body = $response.body;
    }

    if (!body) return null;

    if (body instanceof Uint8Array) {
        return body;
    }

    if (body instanceof ArrayBuffer) {
        return new Uint8Array(body);
    }

    if (ArrayBuffer.isView(body)) {
        return new Uint8Array(
            body.buffer,
            body.byteOffset,
            body.byteLength
        );
    }

    if (Array.isArray(body)) {
        return new Uint8Array(body);
    }

    return null;
}


// ========================
// JPEG
// ========================

function getJpegSize(b) {
    if (
        b.length < 10 ||
        b[0] !== 0xFF ||
        b[1] !== 0xD8
    ) {
        return null;
    }

    let i = 2;

    while (i + 9 < b.length) {

        if (b[i] !== 0xFF) {
            i++;
            continue;
        }

        const marker = b[i + 1];
        i += 2;

        if (
            marker === 0xD8 ||
            marker === 0xD9 ||
            marker === 0x01 ||
            (marker >= 0xD0 && marker <= 0xD7)
        ) {
            continue;
        }

        if (i + 1 >= b.length) break;

        const len =
            (b[i] << 8) |
            b[i + 1];

        if (
            len < 2 ||
            i + len > b.length
        ) {
            break;
        }

        if (
            marker === 0xC0 ||
            marker === 0xC1 ||
            marker === 0xC2 ||
            marker === 0xC3 ||
            marker === 0xC5 ||
            marker === 0xC6 ||
            marker === 0xC7 ||
            marker === 0xC9 ||
            marker === 0xCA ||
            marker === 0xCB ||
            marker === 0xCD ||
            marker === 0xCE ||
            marker === 0xCF
        ) {

            return {
                format: "JPEG",
                width:
                    (b[i + 5] << 8) |
                    b[i + 6],
                height:
                    (b[i + 3] << 8) |
                    b[i + 4]
            };
        }

        i += len;
    }

    return null;
}


// ========================
// PNG
// ========================

function getPngSize(b) {
    if (b.length < 24) return null;

    if (
        b[0] !== 0x89 ||
        b[1] !== 0x50 ||
        b[2] !== 0x4E ||
        b[3] !== 0x47 ||
        b[4] !== 0x0D ||
        b[5] !== 0x0A ||
        b[6] !== 0x1A ||
        b[7] !== 0x0A
    ) {
        return null;
    }

    const width =
        (
            b[16] * 0x1000000 +
            b[17] * 0x10000 +
            b[18] * 0x100 +
            b[19]
        ) >>> 0;

    const height =
        (
            b[20] * 0x1000000 +
            b[21] * 0x10000 +
            b[22] * 0x100 +
            b[23]
        ) >>> 0;

    return {
        format: "PNG",
        width,
        height
    };
}


// ========================
// GIF
// ========================

function getGifSize(b) {
    if (b.length < 10) return null;

    const isGif =
        b[0] === 0x47 &&
        b[1] === 0x49 &&
        b[2] === 0x46 &&
        b[3] === 0x38 &&
        (b[4] === 0x37 || b[4] === 0x39) &&
        b[5] === 0x61;

    if (!isGif) return null;

    return {
        format: "GIF",
        width:
            b[6] |
            (b[7] << 8),
        height:
            b[8] |
            (b[9] << 8)
    };
}


// ========================
// WebP
// ========================

function getWebpSize(b) {

    if (b.length < 30) return null;

    if (
        b[0] !== 0x52 ||
        b[1] !== 0x49 ||
        b[2] !== 0x46 ||
        b[3] !== 0x46 ||
        b[8] !== 0x57 ||
        b[9] !== 0x45 ||
        b[10] !== 0x42 ||
        b[11] !== 0x50
    ) {
        return null;
    }

    const type = String.fromCharCode(
        b[12],
        b[13],
        b[14],
        b[15]
    );

    // VP8X
    if (type === "VP8X" && b.length >= 30) {

        const width =
            1 +
            b[24] +
            (b[25] << 8) +
            (b[26] << 16);

        const height =
            1 +
            b[27] +
            (b[28] << 8) +
            (b[29] << 16);

        return {
            format: "WebP",
            width,
            height
        };
    }

    // VP8 lossless
    if (
        type === "VP8L" &&
        b.length >= 25 &&
        b[20] === 0x2F
    ) {

        const bits =
            (
                b[21] |
                (b[22] << 8) |
                (b[23] << 16) |
                (b[24] << 24)
            ) >>> 0;

        const width =
            (bits & 0x3FFF) + 1;

        const height =
            ((bits >> 14) & 0x3FFF) + 1;

        return {
            format: "WebP",
            width,
            height
        };
    }

    return {
        format: "WebP",
        width: 0,
        height: 0
    };
}


// ========================
// 统一识别
// ========================

function getImageSize(b) {

    return (
        getJpegSize(b) ||
        getPngSize(b) ||
        getWebpSize(b) ||
        getGifSize(b)
    );
}


const bytes = getBytes();

if (!bytes) {

    console.log(
        "[SQB-AD] 未取得二进制响应体 -> 放行"
    );

    $done({});

} else {

    const img = getImageSize(bytes);

    if (!img) {

        console.log(
            "[SQB-AD] 未识别图片格式 -> 放行"
        );

        $done({});

    } else {

        console.log(
            "[SQB-AD] " +
            img.format +
            " " +
            img.width +
            "x" +
            img.height +
            " / " +
            bytes.length +
            " bytes"
        );

        /*
         * 开屏广告判定
         *
         * 当前确认广告：
         * 1125 × 2001
         *
         * 不再写死尺寸：
         * 宽 >= 900
         * 高 >= 1500
         * 高宽比 1.55 ~ 2.30
         */

        const ratio =
            img.width > 0
                ? img.height / img.width
                : 0;

        const isSplash =
            img.width >= 900 &&
            img.height >= 1500 &&
            ratio >= 1.55 &&
            ratio <= 2.30;

        if (isSplash) {

            console.log(
                "[SQB-AD] 命中大尺寸竖屏开屏广告 -> 204"
            );

            $done({
                status: 204,
                headers: {},
                body: ""
            });

        } else {

            console.log(
                "[SQB-AD] 普通图片 -> 放行"
            );

            $done({});
        }
    }
}
