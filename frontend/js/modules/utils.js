import { API_BASE_URL } from '../config.js';

export const formatNaira = amount => new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(amount)||0);
export const escapeText = value => String(value ?? "");
export async function api(path, options={}) {
  const headers = new Headers(options.headers || {});
  if (
    options.body &&
    !(typeof FormData !== "undefined" && options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers
  });
  const data = await response.json().catch(()=>({message:"Unexpected server response"}));
  if(!response.ok) throw new Error(data.message || "Request failed");
  return data;
}
export const byId = id => document.getElementById(id);
export const safeText = (tag,text,className) => { const node=document.createElement(tag); node.textContent=String(text??""); if(className) node.className=className; return node; };
