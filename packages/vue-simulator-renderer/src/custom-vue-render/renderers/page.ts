import { defineComponent, h } from 'vue';
import { useRenderer, rendererProps, useRootScope } from '../core';

const Page = defineComponent((props, { slots }) => {
  return () => h('div', { class: 'lc-page', style: { height: '100%' }, ...props }, slots);
});

export const PageRenderer = defineComponent({
  name: 'PageRenderer',
  props: rendererProps,
  __renderer__: true,
  setup(props, context) {
    const { scope, wrapRender } = useRootScope(props, context);

    // scope, schemaRef, designModeRef, componentsRef 变为动态的计算属性
    /**
     * useLeaf() 返回值
     * node,
     * locked,
     * isRootNode: useIsRootNode(leafProps.__isRootNode),
     * getNode,
     * renderComp：renderHoc : renderLive
     * buildProps,
     * buildSlots,
     */
    const { renderComp, componentsRef, schemaRef } = useRenderer(props, scope);


    return wrapRender(() => {
      return renderComp(schemaRef.value, null, componentsRef.value.Page || Page);
    });
  },
});
