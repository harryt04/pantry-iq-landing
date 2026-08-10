import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-transparent bg-clip-padding px-5 text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        outline:
          'border-2 border-foreground bg-transparent text-foreground hover:bg-muted',
        secondary:
          'border-2 border-foreground bg-transparent text-foreground hover:bg-muted',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive text-destructive-foreground hover:opacity-90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 gap-1.5',
        xs: 'h-11 gap-1 px-4 text-xs',
        sm: 'h-11 gap-1 px-4 text-[0.8rem]',
        lg: 'h-12 gap-1.5 px-6',
        icon: 'size-11 p-0',
        'icon-xs': "size-11 p-0 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-11 p-0',
        'icon-lg': 'size-12 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
