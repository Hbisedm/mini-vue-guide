export function generate(ast) {
  const context = createCodegenContent();
  const { push } = context;
  push("return ");

  push("const { toDisplayString: _toDisplayString } = Vue");

  push("return");

  const functionName = "render";
  const args = ["_ctx", "_cache"];
  const signature = args.join(",");

  push(`function ${functionName}(${signature}){`);
  genNode(ast.codegenNode, context);
  push("}");

  return {
    code: context.code,
  };
}

function createCodegenContent() {
  const context = {
    code: "",
    push(source) {
      context.code += source;
    },
  };
  return context;
}

function genNode(codegenNode: any, context) {
  const { push } = context;
  const node = codegenNode;
  push(`return '${node.content}'`);
}
