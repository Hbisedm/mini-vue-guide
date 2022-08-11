import { NodeTypes } from "./ast";

const enum TagType {
  START,
  END,
}

/**
 * content 统一的入口
 * @param content
 * @returns ast
 */
export function baseParse(content: string): any {
  const context = createParseContext(content);
  return createRoot(parseChildren(context));
}

function parseChildren(context) {
  const nodes: any = [];

  let node;
  const s = context.source;
  /**
   * {{}}
   * 处理插值表达式
   */
  if (s.startsWith("{{")) {
    node = parseInterpolation(context);
  } else if (s[0] === "<") {
    /**
     * 处理Element
     * 使用正则匹配 `<`开头 `[a-z]*`
     */
    if (/[a-z]/.test(s[1])) {
      node = parseElement(context);
    }
  }
  nodes.push(node);
  return nodes;
}
function parseElement(context) {
  const element = parseTag(context, TagType.START);
  parseTag(context, TagType.END);
  return element;
}

function parseTag(context: any, tagType: TagType) {
  /**
   * 1. 解析tag
   */
  const match: any = /^<\/?([a-z]*)/i.exec(context.source);
  const tag = match[1];

  /**
   * 2. 删除已处理完成的代码
   */
  advanceBy(context, match[0].length);
  advanceBy(context, 1);

  if (tagType === TagType.END) return;
  return {
    type: NodeTypes.ELEMENT,
    tag,
  };
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

/**
 * 封装成ctx对象
 * @param content
 * @returns
 */
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
