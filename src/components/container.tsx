import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Container = forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(function Container({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "max-w-8xl mx-auto w-full px-5 tablet:px-8 desktop:px-10",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export default Container;
