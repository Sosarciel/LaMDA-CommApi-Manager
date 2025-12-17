"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListenToolBase = void 0;
const utils_1 = require("@zwa73/utils");
const ListenToolBase = class extends utils_1.EventSystem {
    isRuning() { return true; }
};
exports.ListenToolBase = ListenToolBase;
