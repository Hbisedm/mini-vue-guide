export const extend = Object.assign;
export const isObject = (val) => {
  return val !== null && typeof val === "object";
};
export const hasChange = Object.is;

export const hasOwn = (thisObj, key) =>
  Object.prototype.hasOwnProperty.call(thisObj, key);
