



/**Telegram初始化选项 */
export type TelegramServiceData = {
    /**绑定角色名 */
    charname:string;
    /**登录token*/
    token: string;
    /**用户uid */
    uid:string;
    /**正向代理链接 */
    proxy_url?:string;
}

export type TelegramUserId  = `telegram.user.${string}`;
export type TelegramSource = TelegramUserId | 'telegram';