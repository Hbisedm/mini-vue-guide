import { effect } from "../effect";
import { isReadonly, reactive, readonly } from "../reactive";

describe("readonly", () => {
  it("happy path", () => {
    const original = {
      foo: 1,
    };
    const wrapped = readonly(original);
    expect(wrapped).not.toBe(original);
    expect(wrapped.foo).toBe(1);
    expect(isReadonly(wrapped)).toBe(true);
    expect(isReadonly(original)).toBe(false);
  });
  it("readonly cannot set", () => {
    const user = {
      age: 23,
    };
    console.warn = jest.fn();
    const readonlyUser = readonly(user);
    readonlyUser.age++; // 触发set
    expect(console.warn).toBeCalled();
  });
});
