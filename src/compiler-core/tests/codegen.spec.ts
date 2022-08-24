import { generate } from "../src/codegen";
import { baseParse } from "../src/parse";
import { transform } from "../src/transform";
import { transformExpression } from "../src/transforms/transformExpression";
import { transformText } from "../src/transforms/transformText";
import { transformElement } from "../src/transforms/transformElement";

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

  it("union 3 type", () => {
    const ast = baseParse("<div>hi,{{message}}</div>");
    transform(ast, {
      nodeTransforms: [transformExpression, transformElement, transformText],
    });
    console.log("ast ---", ast);
    const { code } = generate(ast);
    expect(code).toMatchSnapshot();
  });
});
