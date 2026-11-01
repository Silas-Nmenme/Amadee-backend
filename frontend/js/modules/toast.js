import {byId,safeText} from "./utils.js";
export function toast(message,type="success"){const region=byId("toast-region");const item=safeText("div",message,`toast ${type==="error"?"error":""}`);region.append(item);window.setTimeout(()=>item.remove(),4500);}
