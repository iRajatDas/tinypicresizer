import { cn } from "@/lib/utils";
import React, { ElementType, forwardRef } from "react";

interface WrapperProps extends React.PropsWithChildren {
  className?: string;
  as?: ElementType;
}

const Wrapper = forwardRef<HTMLElement, WrapperProps>(
  ({ children, className, as: Component = "section" }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn("w-full max-w-5xl px-4 mx-auto", className)}
      >
        {children}
      </Component>
    );
  }
);

Wrapper.displayName = "Wrapper";

export default Wrapper;
