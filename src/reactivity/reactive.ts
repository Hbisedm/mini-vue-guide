import { isObject } from "./../shared/index";
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReadonlyHandlers,
} from "./baseHandlers";
export const enum ReactiveFlags {
  IS_REACTIVE = "__v_is_reactive",
  IS_READONLY = "__v_is_readonly",
}
export function reactive(raw) {
  return createActivityObj(raw, mutableHandlers);
}
export function readonly(raw) {
  return createActivityObj(raw, readonlyHandlers);
}
function createActivityObj(target: any, baseHandlers: any) {
  if (!isObject(target)) {
    console.warn(`target: ${target} no a object`);
    return target;
  }
  return new Proxy(target, baseHandlers);
}
export function isReactive(raw) {
  return !!raw[ReactiveFlags.IS_REACTIVE];
}
export function isReadonly(raw) {
  return !!raw[ReactiveFlags.IS_READONLY];
}
export function isProxy(value) {
  return isReactive(value) || isReadonly(value);
}
export function shallowReadonly(raw) {
  return createActivityObj(raw, shallowReadonlyHandlers);
}
