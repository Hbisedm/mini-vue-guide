import { camelize, toHandlerKey } from "../shared/index";

export function emit(instance, event, ...args) {
  console.table("instance", instance);
  console.log("emit", event);
  const { props } = instance;
  //TPP
  const handler = props[toHandlerKey(camelize(event))];
  handler && handler(...args);
}
