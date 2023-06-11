import type {
  IPublicModelNode as Node,
  IPublicTypeNodeSchema as NodeSchema,
  IPublicTypeContainerSchema as ContainerSchema,
} from '@alilc/lowcode-types';
import { getRendererContextKey, type DesignMode } from '@knxcloud/lowcode-hooks';
import {
  type PropType,
  type Component,
  type ComponentPublicInstance,
  h,
  reactive,
  provide,
  computed,
  defineComponent,
  shallowRef,
  watch,
  triggerRef,
  ref,
  watchEffect,
} from 'vue';
import {
  type I18nMessages,
  type BlockScope,
  type ExtractPublicPropTypes,
  SchemaParser,
  type RuntimeScope,
} from './utils';
import config from './config';
import { RENDERER_COMPS } from './renderers';
import {
  createObjectSpliter,
  debounce,
  exportSchema,
  isBoolean,
} from '@knxcloud/lowcode-utils';

const vueRendererProps = {
  scope: Object as PropType<BlockScope>,
  schema: {
    type: Object as PropType<ContainerSchema>,
    required: true,
  },
  passProps: Object as PropType<Record<string, unknown>>,
  components: {
    type: Object as PropType<Record<string, Component>>,
    required: true,
  },
  /** 设计模式，可选值：live、design */
  designMode: {
    type: String as PropType<DesignMode>,
    default: 'live',
  },
  /** 设备信息 */
  device: String,
  /** 语言 */
  locale: String,
  messages: {
    type: Object as PropType<I18nMessages>,
    default: () => ({}),
  },
  getNode: Function as PropType<(id: string) => Node | null>,
  /** 组件获取 ref 时触发的钩子 */
  onCompGetCtx: Function as PropType<
    (schema: NodeSchema, ref: ComponentPublicInstance) => void
  >,
  thisRequiredInJSE: {
    type: Boolean,
    default: true,
  },
  disableCompMock: {
    type: [Array, Boolean] as PropType<string[] | boolean>,
    default: false,
  },
} as const;

type VueRendererProps = ExtractPublicPropTypes<typeof vueRendererProps>;

const splitOptions = createObjectSpliter((prop) => !prop.match(/^[a-z]+([A-Z][a-z]+)*$/));


// 单个页面根节点渲染组件
const VueRenderer = defineComponent({
  props: vueRendererProps,
  setup(props, { slots, expose }) {

    // 序列化函数片段
    const parser = new SchemaParser({
      thisRequired: props.thisRequiredInJSE,
    }).initModule(props.schema);


    // 触发根节点更新
    const triggerCompGetCtx = (schema: NodeSchema, val: ComponentPublicInstance) => {
      debugger
      val && props.onCompGetCtx?.(schema, val);
    };

    // documentInstance 获取文档id对应节点
    const getNode = (id: string) => props.getNode?.(id) ?? null;

    // 基本数据类型响应式
    const schemaRef = shallowRef(props.schema);

    // 监听当前段schema
    watch(
      () => props.schema,
      () => (schemaRef.value = props.schema)
    );

    let needWrapComp: (name: string) => boolean = () => true;

    watchEffect(() => {
      const disableCompMock = props.disableCompMock;
      if (isBoolean(disableCompMock)) {
        needWrapComp = disableCompMock ? () => false : () => true;
      } else if (disableCompMock) {
        needWrapComp = (name) => !disableCompMock.includes(name);
      }
    });

    const wrapCached: Map<object, Map<object, any>> = new Map();

    // 渲染器上下文，挂载一些根节点数据信息
    const rendererContext = reactive({
      designMode: computed(() => props.designMode), // 编辑器模式
      components: computed(() => ({ // 组件列表
        ...config.getRenderers(),
        ...props.components,
      })),

      // 获取文档节点方法
      getNode: (id: string) => (props.getNode?.(id) as any) ?? null,
      // 组件更新时触发回调函数
      triggerCompGetCtx: (schema: NodeSchema, inst: ComponentPublicInstance) => {
        debugger
        props.onCompGetCtx?.(schema, inst);
      },

      // 手动触发渲染
      rerender: debounce(() => {
        const id = props.schema.id;
        const node = id && getNode(id);
        if (node) {
          debugger
          const newSchema = exportSchema<ContainerSchema>(node);
          if (newSchema) {
            schemaRef.value = newSchema;
          }
        }

        // 手动执行与 shallowRef 关联的任何副作用，强制更新视图。
        triggerRef(schemaRef);
      }),

      /**
       * wrapLeafComp
       * @param name Page
       * @param comp // displayName : "Page" 渲染组件信息
       * @param leaf Hoc
       */
      wrapLeafComp: <T extends object, L extends object>(
        name: string,
        comp: T,
        leaf: L
      ): L => {
        let record = wrapCached.get(leaf);
        if (record) {
          if (record.has(comp)) {
            return record.get(comp);
          }
        } else {
          record = new Map();

          // 缓存末级节点
          wrapCached.set(leaf, record);
        }

        // TODO 推测应该是在检测是否锁定
        if (needWrapComp(name)) {
          const [privateOptions, _, privateOptionsCount] = splitOptions(comp as any);
          if (privateOptionsCount) {
            leaf = Object.create(leaf, Object.getOwnPropertyDescriptors(privateOptions));
          }
        }
        record.set(comp, leaf);
        return leaf;
      },
    });

    // 渲染上下文注入 windows.__rendererContext，挂载Windows上
    provide(getRendererContextKey(), rendererContext);

    const runtimeScope = ref<RuntimeScope>();

    // 导出运行时scope上下文
    expose({ runtimeScope });

    const renderContent = () => {
      const { components } = rendererContext;

      /**
       * scope  {constants:{},utils:{}}
       * locale: undefined
       * messages: {}
       * designMode: "design"
       * thisRequiredInJSE: true
       * passProps: undefined
       */
      const { scope, locale, messages, designMode, thisRequiredInJSE, passProps } = props;

      const { value: schema } = schemaRef;

      if (!schema) return null;

      const { componentName } = schema;
      let Comp = components[componentName] || components[`${componentName}Renderer`];
      if (Comp && !(Comp as any).__renderer__) {
        Comp = RENDERER_COMPS[`${componentName}Renderer`];
      }

      // Page / PageRenderer
      return Comp
        ? h(
            Comp,
            {
              key: schema.__ctx
                ? `${schema.__ctx.lceKey}_${schema.__ctx.idx || '0'}`
                : schema.id,
              ...passProps,
              ...parser.parseOnlyJsValue(schema.props),
              ref: runtimeScope,
              __parser: parser,
              __scope: scope,
              __schema: schema,
              __locale: locale,
              __messages: messages,
              __components: components,
              __designMode: designMode,
              __thisRequiredInJSE: thisRequiredInJSE,
              __getNode: getNode,
              __triggerCompGetCtx: triggerCompGetCtx,
            } as any,
            slots
          )
        : null;
    };

    return () => {
      const { device, locale } = props;
      const configProvider = config.getConfigProvider();

      return configProvider
        ? h(configProvider, { device, locale }, { default: renderContent })
        : renderContent();
    };
  },
});

export const cleanCacledModules = () => {
  SchemaParser.cleanCacheModules();
};

export { VueRenderer, vueRendererProps };
export type { VueRendererProps, I18nMessages, BlockScope };
