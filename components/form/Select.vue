<script>
import { createPopper } from '@popperjs/core';
import { get } from '@/utils/object';
import LabeledFormElement from '@/mixins/labeled-form-element';
import VueSelectOverrides from '@/mixins/vue-select-overrides';
import LabeledTooltip from '@/components/form/LabeledTooltip';
import $ from 'jquery';
import { onClickOption } from '@/utils/select';

export default {
  components: { LabeledTooltip },
  mixins:     [LabeledFormElement, VueSelectOverrides],
  props:      {
    appendToBody: {
      default: true,
      type:    Boolean,
    },
    disabled: {
      default: false,
      type:    Boolean,
    },
    getKeyForOption: {
      default: null,
      type:    Function
    },
    mode: {
      default: 'edit',
      type:    String,
    },
    optionKey: {
      default: null,
      type:    String,
    },
    optionLabel: {
      default: 'label',
      type:    String,
    },
    options: {
      default:   null,
      type:      Array,
    },
    placement: {
      default: null,
      type:    String,
    },
    placeholder: {
      type:    String,
      default: '',
    },
    popperOverride: {
      type:    Function,
      default: null,
    },
    reduce: {
      default: (e) => {
        if (e && typeof e === 'object' && e.value !== undefined) {
          return e.value;
        }

        return e;
      },
      type: Function,
    },
    tooltip: {
      type:    String,
      default: null,
    },

    hoverTooltip: {
      type:    Boolean,
      default: true,
    },

    searchable: {
      default: false,
      type:    Boolean,
    },
    status: {
      type:    String,
      default: null,
    },
    value: {
      default: null,
      type:    [String, Object, Number, Array, Boolean],
    },
    closeOnSelect: {
      type:    Boolean,
      default: true
    },
  },

  methods: {
    // resizeHandler = in mixin
    getOptionLabel(option) {
      if (this.$attrs['get-option-label']) {
        return this.$attrs['get-option-label'](option);
      }
      if (get(option, this.optionLabel)) {
        if (this.localizedLabel) {
          return this.$store.getters['i18n/t'](get(option, this.optionLabel));
        } else {
          return get(option, this.optionLabel);
        }
      } else {
        return option;
      }
    },
    withPopper(dropdownList, component, { width }) {
      if (this.popperOverride) {
        return this.popperOverride(dropdownList, component, { width });
      }
      /**
       * We need to explicitly define the dropdown width since
       * it is usually inherited from the parent with CSS.
       */
      const componentWidth = $(component.$parent.$el).width();

      dropdownList.style['min-width'] = `${ componentWidth }px`;
      dropdownList.style.width = 'min-content';

      /**
       * Here we position the dropdownList relative to the $refs.toggle Element.
       *
       * The 'offset' modifier aligns the dropdown so that the $refs.toggle and
       * the dropdownList overlap by 1 pixel.
       *
       * The 'toggleClass' modifier adds a 'drop-up' class to the Vue Select
       * wrapper so that we can set some styles for when the dropdown is placed
       * above.
       */
      const popper = createPopper(component.$refs.toggle, dropdownList, {
        placement: this.placement || 'bottom-start',
        modifiers: [
          {
            name:    'offset',
            options: { offset: [0, 2] },
          },
          {
            name:    'toggleClass',
            enabled: true,
            phase:   'write',
            fn({ state }) {
              component.$el.setAttribute('x-placement', state.placement);
            },
          }
        ],
      });

      /**
       * To prevent memory leaks Popper needs to be destroyed.
       * If you return function, it will be called just before dropdown is removed from DOM.
       */
      return () => popper.destroy();
    },

    focus() {
      this.focusSearch();
    },

    focusSearch() {
      this.$nextTick(() => {
        const el = this.$refs['select-input']?.searchEl;

        if ( el ) {
          el.focus();
        }
      });
    },

    get,

    onClickOption(option, event) {
      onClickOption.call(this, option, event);
    },
    selectable(opt) {
      // Lets you disable options that are used
      // for headings on groups of options.
      if ( opt ) {
        if ( opt.disabled || opt.kind === 'group' || opt.kind === 'divider' || opt.loading ) {
          return false;
        }
      }

      return true;
    },
    getOptionKey(opt) {
      if (opt.optionKey) {
        return get(opt, opt.optionKey);
      }

      return this.getOptionLabel(opt);
    },
    report(e) {
      alert(e);
    }
  }
};
</script>

<template>
  <div
    ref="select"
    class="unlabeled-select"
    :class="{
      disabled: disabled && !isView,
      focused,
      [mode]: true,
      [status]: status,
      taggable: $attrs.taggable,
      taggable: $attrs.multiple,
    }"
    @focus="focusSearch"
  >
    <v-select
      ref="select-input"
      v-bind="$attrs"
      class="inline"
      :autoscroll="true"
      :append-to-body="appendToBody"
      :calculate-position="placement ? withPopper : undefined"
      :disabled="isView || disabled"
      :get-option-key="(opt) => getOptionKey(opt)"
      :get-option-label="(opt) => getOptionLabel(opt)"
      :label="optionLabel"
      :options="options"
      :close-on-select="closeOnSelect"
      :map-keydown="mappedKeys"
      :placeholder="placeholder"
      :reduce="(x) => reduce(x)"
      :searchable="isSearchable"
      :selectable="selectable"
      :value="value != null ? value : ''"
      v-on="$listeners"
      @input="(e) => $emit('input', e)"
      @search:blur="onBlur"
      @search:focus="onFocus"
      @open="resizeHandler"
      @option:created="(e) => $emit('createdListItem', e)"
    >
      <template #option="option">
        <div @mousedown="(e) => onClickOption(option, e)">
          {{ option.label }}
        </div>
      </template>
      <!-- Pass down templates provided by the caller -->
      <template v-for="(_, slot) of $scopedSlots" v-slot:[slot]="scope">
        <slot :name="slot" v-bind="scope" />
      </template>
    </v-select>
    <LabeledTooltip
      v-if="tooltip && !focused"
      :hover="hoverTooltip"
      :value="tooltip"
      :status="status"
    />
  </div>
</template>

<style lang="scss" scoped>
  .unlabeled-select {
    position: relative;

    ::v-deep .vs__selected-options {
      display: flex;

      .vs__selected {
          width: 100%;
      }
    }

    @include input-status-color;
  }
</style>
