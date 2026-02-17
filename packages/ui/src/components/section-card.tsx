import React, { type ReactNode } from "react";

import { cn } from "../lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Skeleton } from "./skeleton";

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  description?: string;
  children?: ReactNode;
  className?: string;
  classNameHeader?: string;
  classNameTitle?: string;
  contentClassName?: string;
  variant?: "default" | "elevated" | "outlined" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  empty?:
    | {
        title: string;
        description: string;
        action?: ReactNode;
      }
    | undefined;
  footer?: ReactNode;
  headerClassName?: string;
  titleContainerClassName?: string;
  descriptionClassName?: string;
  verticalLayout?: boolean;
}

const variantClasses = {
  default: "",
  elevated: "shadow-lg",
  outlined: "border-2",
  ghost: "border-none shadow-none bg-transparent",
};

const headerSizeClasses = {
  sm: "px-3 py-2",
  md: "px-4 py-3",
  lg: "px-6 py-4",
};

const contentSizeClasses = {
  sm: "px-3 pb-3",
  md: "px-4 pb-4",
  lg: "px-6 pb-6",
};

export const SectionCard = ({
  title,
  icon,
  action,
  description,
  children,
  className = "",
  classNameHeader = "",
  classNameTitle = "",
  contentClassName = "",
  variant = "default",
  size = "md",
  loading = false,
  empty,
  footer,
  headerClassName,
  titleContainerClassName,
  descriptionClassName,
  verticalLayout = false,
}: SectionCardProps) => {
  if (loading) {
    return (
      <Card className={cn("w-full", variantClasses[variant], className)}>
        <CardHeader
          className={cn(
            verticalLayout
              ? "flex flex-col space-y-0 pb-1"
              : "flex flex-row items-center justify-between pb-1",
            headerSizeClasses[size],
            classNameHeader,
            headerClassName,
          )}
        >
          {verticalLayout ? (
            <div
              className={cn(
                "flex flex-row items-center justify-between w-full",
                titleContainerClassName,
              )}
            >
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="h-8 w-20" />
            </>
          )}
        </CardHeader>
        <CardContent
          className={cn(
            "space-y-4 pt-0",
            contentSizeClasses[size],
            contentClassName,
          )}
        >
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (empty && React.Children.count(children) === 0) {
    return (
      <Card className={cn("w-full", variantClasses[variant], className)}>
        <CardHeader
          className={cn(
            verticalLayout
              ? "flex flex-col space-y-0 pb-1"
              : "flex flex-row items-center justify-between pb-1",
            headerSizeClasses[size],
            classNameHeader,
            headerClassName,
          )}
        >
          {verticalLayout ? (
            <div
              className={cn(
                "flex flex-row items-center justify-between w-full",
                titleContainerClassName,
              )}
            >
              <CardTitle
                className={cn("flex items-center gap-2", classNameTitle)}
              >
                {icon}
                <h3 className="text-lg font-semibold">{title}</h3>
              </CardTitle>
              {action}
            </div>
          ) : (
            <>
              <CardTitle
                className={cn("flex items-center gap-2", classNameTitle)}
              >
                {icon}
                <h3 className="text-lg font-semibold">{title}</h3>
              </CardTitle>
              {action}
            </>
          )}
        </CardHeader>
        <CardContent
          className={cn(
            "space-y-4 pt-0",
            contentSizeClasses[size],
            contentClassName,
          )}
        >
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <h4 className="text-muted-foreground mb-2 text-lg font-medium">
              {empty.title}
            </h4>
            <p className="text-muted-foreground mb-4 max-w-sm text-sm">
              {empty.description}
            </p>
            {empty.action}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", variantClasses[variant], className)}>
      <CardHeader
        className={cn(
          verticalLayout
            ? "flex flex-col space-y-0 pb-1"
            : "flex flex-row items-center justify-between pb-1",
          headerSizeClasses[size],
          classNameHeader,
          headerClassName,
        )}
      >
        {verticalLayout ? (
          <>
            <div
              className={cn(
                "flex flex-row items-center justify-between w-full",
                titleContainerClassName,
              )}
            >
              <CardTitle
                className={cn("flex items-center gap-2", classNameTitle)}
              >
                {icon}
                <h3 className="text-lg font-semibold">{title}</h3>
              </CardTitle>
              {action}
            </div>
            {description ? (
              <CardDescription className={cn("mt-1", descriptionClassName)}>
                {description}
              </CardDescription>
            ) : (
              <CardDescription className="sr-only">{title}</CardDescription>
            )}
          </>
        ) : (
          <>
            <CardTitle
              className={cn("flex items-center gap-2", classNameTitle)}
            >
              {icon}
              <h3 className="text-lg font-semibold">{title}</h3>
            </CardTitle>
            {action}
          </>
        )}
      </CardHeader>
      {children ? (
        <CardContent
          className={cn(
            "space-y-4 pt-0",
            contentSizeClasses[size],
            contentClassName,
          )}
        >
          {children}
        </CardContent>
      ) : null}
      <CardFooter>{footer}</CardFooter>
    </Card>
  );
};
