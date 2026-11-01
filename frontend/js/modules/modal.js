import {byId} from "./utils.js";
let lastFocus=null;
export function openModal(title, contentBuilder, options={}) {
 const root=byId("modal-root"); closeModal(); lastFocus=document.activeElement;
 const backdrop=document.createElement("div");backdrop.className="modal-backdrop";backdrop.dataset.modalBackdrop="true";
 const modal=document.createElement("section");modal.className="modal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label",title);modal.tabIndex=-1;
 const close=document.createElement("button");close.className="modal-close";close.type="button";close.textContent="×";close.setAttribute("aria-label","Close dialog");close.addEventListener("click",closeModal);
 const heading=document.createElement("h2");heading.textContent=title;modal.append(close,heading);contentBuilder(modal);
 backdrop.append(modal);backdrop.addEventListener("click",e=>{if(e.target===backdrop)closeModal()});
 root.append(backdrop);document.body.style.overflow="hidden";modal.focus();
 const onKey=e=>{if(e.key==="Escape")closeModal();if(e.key==="Tab"){const focus=[...modal.querySelectorAll('button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled);if(!focus.length){e.preventDefault();return}const first=focus[0],last=focus[focus.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===modal)){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};
 document.addEventListener("keydown",onKey);backdrop.dataset.keyListener="attached";
 backdrop._cleanup=()=>document.removeEventListener("keydown",onKey);
 return modal;
}
export function closeModal(){const root=byId("modal-root");root.querySelector(".modal-backdrop")?._cleanup?.();root.replaceChildren();document.body.style.overflow="";if(lastFocus?.focus)lastFocus.focus();}
