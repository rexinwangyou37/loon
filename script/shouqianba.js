/*
 * 收钱吧开屏广告
 * 根据 JPEG 实际分辨率识别
 */

function toBytes(body) {
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

    return null;
}

function getJpegSize(bytes) {
    if (!bytes || bytes.length < 10) return null;

    // JPEG SOI
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
        return null;
    }

    let i = 2;

    while (i + 9 < bytes.length) {

        if (bytes[i] !== 0xFF) {
            i++;
            continue;
        }

        let marker = bytes[i + 1];
        i += 2;

        // 无长度的 marker
        if (
            marker === 0xD8 ||
            marker === 0xD9 ||
            marker === 0x01 ||
            (marker >= 0xD0 && marker <= 0xD7)
        ) {
            continue;
        }

        if (i + 1 >= bytes.length) break;

        let length = (bytes[i] << 8) | bytes[i + 1];

        if (length < 2 || i + length > bytes.length) {
            break;
        }

        // SOF markers
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
            let height =
                (bytes[i + 3] << 8) |
                bytes[i + 4];

            let width =
                (bytes[i + 5] << 8) |
                bytes[i + 6];

            return {
                width: width,
                height: height
            };
        }

        i += length;
    }

    return null;
}

const bytes = toBytes($response.body);
const size = getJpegSize(bytes);

if (!size) {
    console.log("[SQB-AD] 非JPEG或尺寸读取失败");
    $done({});
} else {

    console.log(
        "[SQB-AD] JPEG " +
        size.width +
        "x" +
        size.height
    );

    // 当前抓包确认的收钱吧开屏广告尺寸
    if (
        size.width === 1125 &&
        size.height === 2001
    ) {

        console.log(
            "[SQB-AD] 命中开屏广告 1125x2001 -> 204"
        );

        $done({
            status: 204,
            headers: {},
            body: ""
        });

    } else {

        console.log(
            "[SQB-AD] 普通图片，放行"
        );

        $done({});
    }
}
