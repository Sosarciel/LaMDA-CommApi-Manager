// PatchWs.ts
import { workerData } from "worker_threads";
import Module from "module";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { DiscordServiceData } from "./Interface";

let isPatched = false;

export default function patchWs(proxyUrl?: string) {
    if (isPatched) return;

    const targetUrl = proxyUrl ?? (workerData as DiscordServiceData | undefined)?.proxy_url;
    if (!targetUrl) return;

    const proxyAgent = new HttpsProxyAgent(targetUrl);

    // 包装传入的原生 WebSocket 类
    function createProxiedClass(OriginalWs: any) {
        if (OriginalWs.__isProxied) return OriginalWs;

        class ProxiedWebSocket extends OriginalWs {
            static __isProxied = true;
            constructor(address: any, protocols: any, options: any) {
                super(address, protocols, Object.assign({}, options, { agent: proxyAgent }));
            }
        }

        (ProxiedWebSocket as any).WebSocket = ProxiedWebSocket;
        (ProxiedWebSocket as any).default = ProxiedWebSocket;
        (ProxiedWebSocket as any).__isProxied = true;
        return ProxiedWebSocket;
    }

    // 核心：拦截底层 require，通杀所有嵌套在 node_modules 里的私有 ws
    const originalRequire = (Module.prototype as any).require;
    (Module.prototype as any).require = function (id: string) {
        const exports = originalRequire.apply(this, arguments);
        if (id === "ws") {
            const Target = exports.WebSocket || exports;
            return createProxiedClass(Target);
        }
        return exports;
    };

    // 顺带清理已存在的 require.cache 缓存（处理顶层 ws）
    for (const key of Object.keys(require.cache)) {
        if (key.includes("ws") && require.cache[key]?.exports) {
            const exp = require.cache[key]!.exports;
            const Target = exp.WebSocket || exp;
            require.cache[key]!.exports = createProxiedClass(Target);
        }
    }

    isPatched = true;
}