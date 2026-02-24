import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { cn } from "@workspace/ui/lib/utils";
import { useTranslation } from "react-i18next";
import { PlaneIllustration } from "./plane-illustration";

interface EmptyStateProps {
  /**
   * Titre de l'état vide. Par défaut: t("search.noFlights") ou t("common.error")
   */
  title?: string;
  /**
   * Description de l'état vide. Par défaut: t("search.tryDifferentDates")
   */
  description?: string;
  /**
   * Action à afficher (ex: un bouton)
   */
  action?: React.ReactNode;
  /**
   * Icône ou média à afficher. Par défaut: <PlaneIllustration />
   */
  icon?: React.ReactNode;
  /**
   * Si true, affiche l'état dans un mode erreur avec une classe destructive
   */
  isError?: boolean;
  /**
   * Classes CSS additionnelles pour le conteneur
   */
  className?: string;
}

export const EmptyState = ({
  title,
  description,
  action,
  icon = <PlaneIllustration />,
  isError = false,
  className,
}: EmptyStateProps) => {
  const { t } = useTranslation();

  return (
    <div className={cn("flex items-center justify-center p-4", className)}>
      <Empty
        className={cn(
          "py-12 border-dashed transition-colors duration-200",
          isError && "border-destructive/30 bg-destructive/5",
        )}
      >
        <EmptyHeader>
          <EmptyMedia className={cn(isError ? "opacity-60" : "")}>
            {icon}
          </EmptyMedia>
          <EmptyTitle
            className={cn(isError ? "text-destructive font-semibold" : "")}
          >
            {title || (isError ? t("common.error") : t("search.noFlights"))}
          </EmptyTitle>
          <EmptyDescription>
            {description ||
              (isError ? t("results.error") : t("search.tryDifferentDates"))}
          </EmptyDescription>
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  );
};
