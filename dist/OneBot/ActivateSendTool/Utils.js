"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chkType = void 0;
const chkType = (opt) => {
    if (/.+user.+/.test(opt.channelId))
        return "private_message";
    return "group_message";
};
exports.chkType = chkType;
