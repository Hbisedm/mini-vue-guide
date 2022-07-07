import { reactive, isReactive } from "../reactive";

describe("reactive", () => {
  it("happy path", () => {
    const originUser = {
      age: 19,
    };
    const user = reactive(originUser);
    expect(user).not.toBe(originUser);
    expect(user.age).toBe(19);
    expect(isReactive(user)).toBe(true);
    expect(isReactive(originUser)).toBe(false);
  });
});
