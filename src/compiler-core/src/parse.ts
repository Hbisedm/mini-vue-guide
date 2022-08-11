import { NodeTypes } from "./ast";

export function baseParse(content: string): any {
  const context = createParseContext(content);
  return createRoot(parseChildren(context));
}

function parseChildren(context) {
  const nodes: any = [];

  /**
   * {{}}
   */
  let node;
  if (context.source.startsWith("{{")) {
    node = parseInterpolation(context);
  }

  nodes.push(node);

  return nodes;
}

function parseInterpolation(context) {
  // {{message}}
  const openDelimiter = "{{";
  const closeDelimiter = "}}";
  /**
   * 拿到字符尾部索引
   */
  const closeIndex = context.source.indexOf(
    closeDelimiter,
    openDelimiter.length
  );
  /**
   *  推进
   *  {{msg}}{{name}} => msg}}{{name}}
   */
  advanceBy(context, openDelimiter.length);

  /**
   * 计算出插值模版里面字符的长度
   */
  const rawContentLength = closeIndex - openDelimiter.length;

  const rawContent = context.source.slice(0, rawContentLength);
  const content = rawContent.trim();
  /**
   * 继续推进
   * msg}}{{name}} => {{name}}
   */
  advanceBy(context, rawContentLength + closeDelimiter.length);

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content,
    },
  };
}

function advanceBy(context, length) {
  context.source = context.source.slice(length);
}

function createParseContext(content: string): any {
  return {
    source: content,
  };
}

function createRoot(children) {
  return {
    children,
  };
}
