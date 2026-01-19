import https from 'https';

import type { NeedInit} from "@zwa73/utils";
import { Failed, SLogger, Success, UtilHttp } from "@zwa73/utils";


import type { AccessTokenResponse } from "./BotInterface";




export class QQOfficialBot implements NeedInit{
    private _accessToken?: string;
    private _tokenTimer?: NodeJS.Timeout;
    inited;

    constructor(private _appId: string, private _clientSecret: string) {
        this.inited = this.refreshToken();
    }

    /**刷新token */
    private async refreshToken() {
        const opt={
            method: 'POST' as const,
            hostname: 'bots.qq.com',
            path: '/app/getAppAccessToken',
        };
        const dat = {
            appId: this._appId,
            clientSecret: this._clientSecret,
        };
        const resp = (await UtilHttp.httpsPostJson()
            .option(opt)
            .retry({
                verify:(d)=>{
                    const dat = d?.data as AccessTokenResponse|undefined;
                    if(dat!=undefined && dat.access_token!=null)
                        return Success;
                    return Failed;
                },
                json:dat,
            }))?.completed as AccessTokenResponse|undefined;

        if (resp != null) {
            this._accessToken = resp.access_token;
            SLogger.info("Token刷新成功");

            if (this._tokenTimer) clearTimeout(this._tokenTimer);
            this._tokenTimer = setTimeout(
                async () => this.refreshToken(),
                (resp.expires_in - 60) * 1000
            );
            return;
        }
        SLogger.warn("refreshToken 失败, 未能获取新的Token");
    }
}
