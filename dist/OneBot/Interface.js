"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubtypeDefineTable = void 0;
const utils_1 = require("@zwa73/utils");
const ActivateSendTool_1 = require("./ActivateSendTool");
exports.SubtypeDefineTable = {
    kook: {
        flag: 'kook',
        astCtor: ActivateSendTool_1.KookActiveSendToolCtor,
    },
    qq: {
        flag: 'qq',
        astCtor: ActivateSendTool_1.QQActiveSendToolCtor,
    },
    qq_official: {
        flag: 'qq_official',
        astCtor: ActivateSendTool_1.QQOfficialActiveSendToolCtor,
    },
};
(0, utils_1.assertType)(exports.SubtypeDefineTable);
