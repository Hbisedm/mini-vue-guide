import { generate } from "../src/codege";
import { baseParse } from "../src/parse";
import { transform } from "../src/transform";
import { transformExpression } from "../src/transforms/transformExpression";
import { transformElement } from "../src/transforms/transfromElement";

describe("codegen", () => {
  it("string", () => {
    const ast = baseParse("hi");
    transform(ast);
    const { code } = generate(ast);

    expect(code).toMatchSnapshot();
  });

  it("interpolation", () => {
    const ast = baseParse("{{message}}");
    transform(ast, {
      nodeTransforms: [transformExpression],
    });
    const { code } = generate(ast);
    expect(code).toMatchSnapshot();
  });

  it("element", () => {
    const ast = baseParse("<div></div>");
    transform(ast, {
      nodeTransforms: [transformElement],
    });
    const { code } = generate(ast);
    expect(code).toMatchSnapshot();
  });
});
