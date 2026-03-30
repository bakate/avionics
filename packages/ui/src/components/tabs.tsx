import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "gap-2 group/tabs flex data-horizontal:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "inline-flex items-center justify-center text-muted-foreground transition-all flex-row",
  {
    variants: {
      variant: {
        default: "rounded-lg bg-muted p-1 h-10",
        capsule:
          "rounded-full bg-white/5 border border-white/10 p-1.5 h-14 backdrop-blur-md",
        line: "gap-6 bg-transparent h-12 border-b border-border w-full justify-start rounded-none px-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "rounded-md px-3 py-1.5 text-sm font-medium data-selected:bg-background data-selected:text-foreground data-selected:shadow-sm",
        capsule:
          "rounded-full px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white/50 hover:text-white/80 data-selected:bg-white data-selected:text-royal-blue data-selected:shadow-lg",
        line: "relative px-1 py-4 text-sm font-medium text-muted-foreground hover:text-foreground data-selected:text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:opacity-0 data-selected:after:opacity-100 after:transition-all",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsTrigger({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.Tab.Props & VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      data-variant={variant}
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("text-sm flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
