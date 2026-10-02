// ======================================================
// 万嘉管家 - 微信游戏广告精准预拦截 / 诊断版
//
// 已确认目标：
// 1. 5秒全屏广告：URL 出现 ads_svp_video__
// 2. 30秒插屏广告：posid=3030046789020061
//
// 万嘉管家小程序 AppID：
// wxd75da208031717f6
//
// 原则：
// - 确认广告：真正 HARD DROP
// - 普通 wximg 素材：只记录，不乱拦
// ======================================================

const url = $request.url || "";
const headers = $request.headers || {};

const referer =
    headers["Referer"] ||
    headers["referer"] ||
    "";

const TARGET_APPID = "wxd75da208031717f6";


// ==============================
// 判断类型
// ==============================

// 万嘉管家小程序来源
const isTargetMiniProgram =
    referer.indexOf("servicewechat.com/" + TARGET_APPID + "/") !== -1;

// 5秒全屏视频广告
const isSplashGameAd =
    /ads_svp_video__/i.test(url);

// 30秒插屏广告
const isInterstitialGameAd =
    /[?&]posid=3030046789020061(?:&|$)/i.test(url);


// ==============================
// 日志
// ==============================

console.log("[WXAD] ==============================");
console.log("[WXAD] URL = " + url);
console.log("[WXAD] Referer = " + referer);


// ==============================
// 5秒全屏广告
// ==============================

if (isSplashGameAd) {

    console.log("[WXAD] ★ 5秒全屏游戏广告");
    console.log("[WXAD] ★ HARD DROP");

    // 真正终止请求
    $done();
    return;
}


// ==============================
// 30秒插屏广告
// ==============================

if (isInterstitialGameAd) {

    console.log("[WXAD] ★ 30秒插屏游戏广告");
    console.log("[WXAD] ★ posid = 3030046789020061");
    console.log("[WXAD] ★ HARD DROP");

    // 真正终止请求
    $done();
    return;
}


// ==============================
// 万嘉管家中的其他微信广告素材
// 现在只记录，不拦截
// ==============================

if (
    isTargetMiniProgram &&
    /^https?:\/\/wximg\.wxs\.qq\.com\//i.test(url)
) {

    console.log(
        "[WXAD] 未识别的 wximg 素材 → 暂时放行"
    );

    console.log(
        "[WXAD] 后续用来寻找真正广告主资源"
    );

    $done({});
    return;
}


// ==============================
// 其他请求
// ==============================

$done({});
