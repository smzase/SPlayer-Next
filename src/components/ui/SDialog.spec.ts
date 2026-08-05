import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import SDialog from "./SDialog.vue";

const DialogRootStub = defineComponent({
  props: {
    open: Boolean,
  },
  emits: {
    "update:open": (_open: boolean) => true,
  },
  setup(props, { emit, slots }) {
    return () =>
      h(
        "div",
        {
          "data-dialog-root": "",
          "data-open": String(props.open),
        },
        [
          h(
            "button",
            {
              "data-request-close": "",
              onClick: () => emit("update:open", false),
            },
            "close",
          ),
          slots.default?.(),
        ],
      );
  },
});

describe("SDialog 受控状态", () => {
  it("父组件拒绝关闭时保持打开", async () => {
    const wrapper = mount(SDialog, {
      props: {
        open: true,
        title: "编辑",
      },
      global: {
        renderStubDefaultSlot: true,
        stubs: {
          DialogRoot: DialogRootStub,
          DialogTrigger: true,
          DialogPortal: true,
          DialogOverlay: true,
          DialogContent: true,
          DialogTitle: true,
          DialogDescription: true,
          DialogClose: true,
          SButton: true,
        },
      },
    });

    await wrapper.get("[data-request-close]").trigger("click");

    expect(wrapper.emitted("update:open")).toEqual([[false]]);
    expect(wrapper.get("[data-dialog-root]").attributes("data-open")).toBe("true");
  });
});
