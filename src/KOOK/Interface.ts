




/**KOOK初始化选项 */
export type KOOKServiceData = {
    /**绑定角色名 */
    charname:string;
    /**登录token*/
    token:string;
    /**自身id */
    self_id:string;
}



export type KOOKUserId  = `kook.user.${string}`;
export type KOOKGuildId = `kook.guild.${string}`;
export type KOOKChannelId = `kook.channel.${string}`;
export type KOOKSource = KOOKUserId | KOOKGuildId | KOOKChannelId;
