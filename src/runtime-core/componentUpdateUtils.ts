export function shouldUpdateComponent(prevVNode, nextVNode) {
  const { props: prevProps } = prevVNode;
  const { props: nextProps } = nextVNode;
  for (const key in nextProps) {
    /** 简单判断下 新旧节点的props是否一样 */
    if (nextProps[key] !== prevProps[key]) {
      return true;
    }
  }
  return false;
}
