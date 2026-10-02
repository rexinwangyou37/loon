/*
 * 万嘉管家微信小程序游戏广告预拦截
 *
 * 目标：
 * 1. 拦截微信插屏广告位 posid=3030046789020061
 * 2. 拦截 ads_svp_video__ 视频/游戏广告
 * 3. 拦截同一视频广告附带的配套素材
 *
 * 重点：
 * 在 HTTP-REQUEST 阶段直接返回 404，
 * 尽量让微信广告 SDK 判定“加载失败”，
 * 而不是图片加载后再拦，避免黑屏倒计时。
 */

const url = $request.url || "";
const headers = $request.headers || {};

// ==============================
// Header 大小写兼容
// ==============================
function getHeader(name) {
    const target = name.toLowerCase();

    for (const key in headers) {
        if (key.toLowerCase() === target) {
            return headers[key] || "";
        }
    }

    return "";
}

const referer = getHeader("referer");
const userAgent = getHeader("user-agent");


// ==============================
// 已确认的小程序 AppID
// ==============================
const MINI_APP_ID = "wxd75da20803171f76";


// ==============================
// 已确认广告位
// ==============================
const INTERSTITIAL_POSID = "3030046789020061";


// ==============================
// 基础判断
// ==============================
const isWxImg =
    /^https?:\/\/wximg\.wxs\.qq\.com\//i.test(url);


// ==============================
// 规则 1：插屏广告
// ==============================
//
// HAR 中确认：
// ?posid=3030046789020061
//
const isInterstitialAd =
    isWxImg &&
    new RegExp(
        "[?&]posid=" +
        INTERSTITIAL_POSID +
        "(?:&|$)",
        "i"
    ).test(url);


// ==============================
// 规则 2：视频 / 游戏广告核心素材
// ==============================
//
// 典型：
// /snssvpdownload/.../reserved/
// ads_svp_video__xxxx.jpeg
//
const isSvpVideoAd =
    isWxImg &&
    /\/snssvpdownload\/.*\/reserved\/ads_svp_video__/i.test(url);


// ==============================
// 规则 3：视频广告配套素材
// ==============================
//
// HAR 中 ads_svp_video__ 同一时刻还有：
// /snscosdownload/.../reserved/xxxx
//
// 这些请求带：
// Referer:
// https://servicewechat.com/wxd75da20803171f76/xxx/page-frame.html
//
// 所以只针对这个小程序，不全局封杀微信 CDN。
// ==============================
const isMiniProgramAdCompanion =
    isWxImg &&
    referer.includes(
        "servicewechat.com/" +
        MINI_APP_ID +
        "/"
    ) &&
    /\/snscosdownload\/.*\/reserved\//i.test(url);


// ==============================
// 快速返回广告加载失败
// ==============================
function block(reason) {

    console.log(
        "[WXAD] BLOCK = " +
        reason
    );

    console.log(
        "[WXAD] URL = " +
        url
    );

    if (referer) {
        console.log(
            "[WXAD] Referer = " +
            referer
        );
    }

    /*
     * 不返回透明图片。
     *
     * 如果返回 200 + 空图，
     * 微信可能认为广告“加载成功”，
     * 然后照样启动 5 秒/30 秒计时器。
     *
     * 直接返回 404，
     * 目的是触发广告 SDK 加载失败。
     */
    $done({
        response: {
            status: 404,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "Pragma": "no-cache",
                "Content-Length": "0"
            },
            body: ""
        }
    });
}


// ==============================
// 开始判断
// ==============================

if (isInterstitialAd) {

    block(
        "插屏广告 posid=" +
        INTERSTITIAL_POSID
    );

} else if (isSvpVideoAd) {

    block(
        "ads_svp_video 视频广告"
    );

} else if (isMiniProgramAdCompanion) {

    block(
        "游戏广告配套素材"
    );

} else {

    // 其他 wximg 正常放行
    console.log(
        "[WXAD] PASS = " +
        url
    );

    $done({});
}
