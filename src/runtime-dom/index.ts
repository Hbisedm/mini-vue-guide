import { createRenderer } from "../runtime-core";

function createElement(type) {
  return document.createElement(type);
}

function patchProp(el, key, val) {
  const isOn = (eventName) => /^on[A-Z]/.test(eventName);
  if (isOn(key)) {
    const eventName = key.slice(2).toLowerCase();
    console.log("<---- addEventListener run ---->");
    console.log(`eventName => ${eventName},
      event handler func => ${val}`);
    el.addEventListener(eventName, val);
  } else {
    el.setAttribute(key, val);
  }
}

function insert(el, parent) {
  parent.append(el);
}

export const renderer: any = createRenderer({
  createElement,
  patchProp,
  insert,
});
export function createApp(...args) {
  return renderer.createApp(...args);
}

export * from "../runtime-core";
