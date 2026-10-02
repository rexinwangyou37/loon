/**
 * 微信小程序/小游戏 广点通(GDT)广告拦截与替换脚本
 * 作用：拦截广告请求响应体，修改状态码为无广告填充(102006)，抹除广告素材 URL
 */

const url = $request.url;
let body = $response.body;

if (body) {
    try {
        let obj = JSON.parse(body);

        // 1. 修改腾讯广点通全局返回码为无广告填充
        if (obj.hasOwnProperty('ret')) {
            obj.ret = 102006; // 102006 在 GDT SDK 中代表 No Ad / 广告拉取失败
        }

        // 2. 清空广告位数据结构
        if (obj.pos_ads) {
            obj.pos_ads = {};
        }

        // 3. 清空列表类广告数据
        if (Array.isArray(obj.ad_info)) {
            obj.ad_info = [];
        }
        if (Array.isArray(obj.data)) {
            obj.data = [];
        }

        // 4. 清理 msg
        if (obj.msg) {
            obj.msg = "No Ad Available";
        }

        body = JSON.stringify(obj);
    } catch (e) {
        // 非标准 JSON 响应则不做处理
    }
}

$done({ body });
