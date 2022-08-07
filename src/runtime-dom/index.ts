import { createRenderer } from "../runtime-core";

function createElement(type) {
  return document.createElement(type);
}

function patchProp(el, key, oldVal, nextVal) {
  const isOn = (eventName) => /^on[A-Z]/.test(eventName);
  if (isOn(key)) {
    const eventName = key.slice(2).toLowerCase();
    console.log("<---- addEventListener run ---->");
    console.log(`eventName => ${eventName},
      event handler func => ${nextVal}`);
    el.addEventListener(eventName, nextVal);
  } else {
    if (nextVal === undefined || nextVal === null) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, nextVal);
    }
  }
}

function insert(el, parent, anchor) {
  // parent.append(el);
  parent.insertBefore(el, anchor || null);
}

function remove(child) {
  // Implement
  const parent = child.parentNode;
  if (parent) {
    parent.removeChild(child);
  }
}

function setElementText(el, text) {
  el.textContent = text;
}

export const renderer: any = createRenderer({
  createElement,
  patchProp,
  insert,
  remove,
  setElementText,
});
export function createApp(...args) {
  return renderer.createApp(...args);
}

export * from "../runtime-core";
