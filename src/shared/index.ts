export const extend = Object.assign;
export const isObject = (val) => {
  return val !== null && typeof val === "object";
};
export const hasChange = Object.is;

export const hasOwn = (thisObj, key) =>
  Object.prototype.hasOwnProperty.call(thisObj, key);

export const camelize = (str: string) => {
  return str.replace(/-(\w)/g, (_, a: string) => {
    return a ? a.toUpperCase() : "";
  });
};
export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};
export const toHandlerKey = (str: string) => {
  return "on" + capitalize(str);
};
