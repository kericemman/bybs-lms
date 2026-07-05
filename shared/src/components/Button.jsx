import { cn } from "../lib/cn.js";

const variants = {
  primary: "bg-bybs-blue text-white hover:bg-bybs-blueHover focus-visible:ring-bybs-pale",
  secondary: "bg-white text-bybs-navy ring-1 ring-bybs-border hover:bg-bybs-pale focus-visible:ring-bybs-pale",
  ghost: "bg-transparent text-bybs-body hover:bg-bybs-pale hover:text-bybs-blue focus-visible:ring-bybs-pale",
  danger: "bg-bybs-rose text-white hover:bg-bybs-roseHover focus-visible:ring-bybs-blush"
};

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "h-10 w-10 p-0"
};

export function Button({
  as: Component = "button",
  children,
  className,
  icon: Icon,
  size = "md",
  variant = "primary",
  ...props
}) {
  return (
    <Component
      className={cn(
        "inline-flex max-w-full items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
      {children ? <span className="min-w-0 truncate">{children}</span> : null}
    </Component>
  );
}
