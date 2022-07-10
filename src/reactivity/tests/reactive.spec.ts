import { reactive, isReactive, isProxy } from "../reactive";

describe("reactive", () => {
  it("happy path", () => {
    const originUser = {
      name: "Hbisedm",
      age: 19,
      friend: {
        name: "Sam",
      },
    };
    const user = reactive(originUser);
    expect(user).not.toBe(originUser);
    expect(user.age).toBe(19);
    expect(isReactive(user)).toBe(true);
    expect(isReactive(originUser)).toBe(false);
    expect(isReactive(user.friend)).toBe(true);
    expect(isReactive(originUser.friend)).toBe(false);
    expect(isProxy(user)).toBe(true);
  });
});
