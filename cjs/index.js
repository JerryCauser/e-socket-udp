var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var e_udp_socket_exports = {};
__export(e_udp_socket_exports, {
  DEFAULT_PORT: () => import_constants.DEFAULT_PORT,
  UDPClient: () => import_client.default,
  UDPSocket: () => import_socket.default,
  _constants: () => _constants,
  _identifier: () => _identifier
});
module.exports = __toCommonJS(e_udp_socket_exports);
var import_socket = __toESM(require("./src/socket.js"), 1);
var import_client = __toESM(require("./src/client.js"), 1);
var import_constants = require("./src/constants.js");
var _identifier = __toESM(require("./src/identifier.js"), 1);
var _constants = __toESM(require("./src/constants.js"), 1);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_PORT,
  UDPClient,
  UDPSocket,
  _constants,
  _identifier
});
