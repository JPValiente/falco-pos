/*
 * Text fields (inputs, selects, text areas...): rounder, a touch taller, with a soft shadow and a
 * darker border on hover.
 */
const field = {
  slots: {
    base: 'rounded-lg transition-[color,background-color,box-shadow]'
  },
  variants: {
    size: {
      md: { base: 'py-2' }
    },
    variant: {
      outline: 'shadow-xs hover:ring-(--ui-color-neutral-300) dark:hover:ring-(--ui-color-neutral-600)'
    }
  }
}

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate'
    },
    // Hooks for the phone layout in assets/css/main.css
    dashboardNavbar: {
      slots: {
        root: 'falco-navbar px-3 sm:px-6',
        right: 'falco-nav-actions gap-2'
      }
    },
    // Pages on a light gray background (main.css)
    dashboardPanel: {
      slots: {
        body: 'falco-page'
      }
    },
    // Alerts clip their content (overflow-hidden), so in a panel's scrolling column a long page would
    // squeeze them and cut their text: they never shrink
    alert: {
      slots: {
        root: 'shrink-0'
      }
    },
    dashboardSidebar: {
      slots: {
        body: 'gap-1 py-3'
      }
    },
    // Tables are white cards; phones: tighter cells, and text may wrap
    table: {
      slots: {
        root: 'falco-card',
        thead: 'bg-elevated/50',
        th: 'px-3 sm:px-4',
        td: 'px-3 py-3 sm:p-4 whitespace-normal sm:whitespace-nowrap'
      }
    },
    dashboardToolbar: {
      slots: {
        root: 'falco-toolbar min-h-14 py-2',
        left: 'gap-2',
        right: 'gap-2'
      }
    },
    // The menu: bigger icons, roomier items; the current page in the company color with a bar on its side
    navigationMenu: {
      slots: {
        link: 'gap-2.5 before:rounded-lg',
        linkLeadingIcon: 'size-[22px]'
      },
      variants: {
        orientation: {
          vertical: { link: 'px-3 py-2' }
        },
        active: {
          false: { link: 'text-toned', linkLeadingIcon: 'text-muted' }
        }
      },
      compoundVariants: [{
        orientation: 'vertical',
        collapsed: true,
        class: { link: 'px-[5px]' }
      }, {
        variant: 'pill',
        active: false,
        disabled: false,
        class: { link: 'hover:before:bg-elevated/70', linkLeadingIcon: 'group-hover:text-primary' }
      }, {
        variant: 'pill',
        active: true,
        orientation: 'vertical',
        class: {
          link: 'font-semibold before:bg-primary/10 dark:before:bg-primary/15 after:absolute after:start-0 after:inset-y-2 after:w-[3px] after:rounded-e-full after:bg-primary'
        }
      }]
    },
    // Buttons: rounder and bolder; solid ones with a light sheen, a colored shadow and a press effect
    button: {
      slots: {
        base: 'rounded-lg font-semibold transition-[color,background-color,box-shadow,translate] duration-150 active:translate-y-px disabled:active:translate-y-0 aria-disabled:active:translate-y-0'
      },
      variants: {
        size: {
          md: { base: 'px-3 py-2' }
        }
      },
      compoundVariants: [{
        size: 'md',
        square: true,
        class: 'p-2'
      }, {
        variant: 'solid',
        class: 'bg-linear-to-b from-white/15 to-white/0 shadow-sm inset-shadow-[0_1px_0_rgb(255_255_255/0.25)]'
      }, {
        color: 'primary',
        variant: 'solid',
        class: 'shadow-primary/30 hover:bg-primary/90 active:bg-primary/85'
      }, {
        color: 'secondary',
        variant: 'solid',
        class: 'shadow-secondary/30 hover:bg-secondary/90 active:bg-secondary/85'
      }, {
        color: 'success',
        variant: 'solid',
        class: 'shadow-success/30 hover:bg-success/90 active:bg-success/85'
      }, {
        color: 'info',
        variant: 'solid',
        class: 'shadow-info/30 hover:bg-info/90 active:bg-info/85'
      }, {
        color: 'warning',
        variant: 'solid',
        class: 'shadow-warning/30 hover:bg-warning/90 active:bg-warning/85'
      }, {
        color: 'error',
        variant: 'solid',
        class: 'shadow-error/30 hover:bg-error/90 active:bg-error/85'
      }, {
        color: 'neutral',
        variant: 'solid',
        class: 'shadow-black/20 hover:bg-inverted/85 active:bg-inverted/80'
      }, {
        variant: 'outline',
        class: 'bg-default shadow-xs'
      }, {
        color: 'neutral',
        variant: 'outline',
        class: 'hover:bg-elevated/60 hover:ring-(--ui-color-neutral-300) dark:hover:ring-(--ui-color-neutral-600)'
      }]
    },
    input: field,
    inputMenu: field,
    inputNumber: field,
    inputTags: field,
    select: field,
    selectMenu: field,
    textarea: field
  }
})
