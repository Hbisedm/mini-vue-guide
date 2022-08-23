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
  return createRoot(parseChildren(context, []));
}

function parseChildren(context, ancestors) {
  const nodes: any = [];
  while (!isEnd(context, ancestors)) {
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
        node = parseElement(context, ancestors);
      }
    } else {
      node = parseText(context);
    }
    nodes.push(node);
  }
  return nodes;
}

function isEnd(context, ancestors) {
  const s = context.source;
  // Implement
  // 1. context.source 空
  // 2. tag
  if (s.startsWith("</")) {
    /** 优化倒序，提高遍历性能 */
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const tag = ancestors[i].tag;
      if (startsWithEndTagOpen(s, tag)) {
        // if (s.slice(2, 2 + tag.length) === tag) {
        return true;
      }
    }
  }

  return !s;
}

function parseText(context) {
  let endIndex = context.source.length;

  const endTokens = ["{{", "<"];

  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i]);
    /** 取出最小值 */
    if (index !== -1 && endIndex > index) {
      endIndex = index;
    }
  }
  let content = parseTextData(context, endIndex);
  // console.log("parseTexted ----");
  // console.log(content);

  return {
    type: NodeTypes.TEXT,
    content,
  };
}

function parseTextData(context: any, length) {
  /** 1. 获取值 */
  let content = context.source.slice(0, length);
  /** 2. 推进 */
  advanceBy(context, length);
  return content;
}

function parseElement(context, ancestors) {
  const element: any = parseTag(context, TagType.START);
  ancestors.push(element);
  element.children = parseChildren(context, ancestors);
  ancestors.pop();
  // console.log(" hbisedm Log...");
  // console.log(element.tag);
  // console.log(context.source);

  if (startsWithEndTagOpen(context.source, element.tag)) {
    // if (context.source.slice(2, 2 + element.tag.length) === element.tag) {
    parseTag(context, TagType.END);
  } else {
    throw new Error(`应该来个${element.tag}结尾`);
  }
  return element;
}

function startsWithEndTagOpen(source, tag) {
  return (
    source.startsWith("</") &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase()
  );
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

  const rawContent = parseTextData(context, rawContentLength);
  const content = rawContent.trim();
  /**
   * 继续推进
   * msg}}{{name}} => {{name}}
   */
  advanceBy(context, closeDelimiter.length);

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
    type: NodeTypes.ROOT,
  };
}
