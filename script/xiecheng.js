const notifyTitle = "携程旅行";
const authKey = "CTRIP_AUTH";
let notifyMsg = [];

if (typeof $response !== "undefined") {
    // 获取授权
    try {
        let body = JSON.parse($response.body || "{}");
        if (body.ticket && body.uid) {
            let data = JSON.parse($persistentStore.read(authKey) || "{}");
            data[body.uid] = body.ticket;
            $persistentStore.write(JSON.stringify(data), authKey);
            notify(`账号[${body.uid}] 授权成功`);
        }
    } catch (e) {
        notify("授权写入失败");
    }
    $done({});
} else {
    // 定时签到
    let data = JSON.parse($persistentStore.read(authKey) || "{}");
    let uids = Object.keys(data);
    if (uids.length === 0) {
        notify("未获取到授权，请先抓包登录");
        $done();
    } else {
        (async () => {
            for (let uid of uids) {
                let ticket = data[uid];
                let res1 = await signToday(ticket);
                let res2 = await signApplet(ticket);
                let points = await getPoints(ticket);
                notifyMsg.push(`账号[${uid}]: ${res1}, ${res2}, 积分:${points}`);
            }
            notify(notifyMsg.join("\n"));
            $done();
        })();
    }
}

function signToday(auth) {
    let url = "https://m.ctrip.com/restapi/soa2/22769/signToday";
    let headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 MicroMessenger/8.0.49"
    };
    let body = JSON.stringify({ head: { auth } });
    return httpPost(url, headers, body).then(res => {
        if (res.code === 0) return "签到成功";
        if (res.code === 400001) return "已签到";
        if (res.code === 404001) return "授权失效";
        return `失败(${res.message || "未知错误"})`;
    }).catch(() => "签到请求失败");
}

function signApplet(auth) {
    let url = "https://m.ctrip.com/restapi/soa2/14160/signInWechatPoint";
    let headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 MicroMessenger/8.0.49"
    };
    let body = JSON.stringify({ head: { auth } });
    return httpPost(url, headers, body).then(res => {
        if (res.resultCode === 200) return "小程序签到成功";
        if (res.resultCode === 500) return "已签到";
        if (res.resultCode === 404001) return "授权失效";
        return `失败(${res.message || "未知错误"})`;
    }).catch(() => "小程序签到请求失败");
}

function getPoints(auth) {
    let url = "https://m.ctrip.com/restapi/soa2/15634/json/getPointsOrderUserInfo";
    let headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 MicroMessenger/8.0.49"
    };
    let body = JSON.stringify({ needUserInfo: true, head: { auth } });
    return httpPost(url, headers, body).then(res => {
        return res.isLogin ? res.availableCredits || 0 : "查询失败";
    }).catch(() => "查询失败");
}

function httpPost(url, headers, body) {
    return new Promise((resolve, reject) => {
        $httpClient.post({ url, headers, body }, (err, resp, data) => {
            if (err) return reject(err);
            try {
                resolve(JSON.parse(data));
            } catch {
                reject("解析失败");
            }
        });
    });
}

function notify(msg) {
    $notification.post(notifyTitle, "", msg);
}
