"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModalContextValue = {
  titleId: string;
  onClose: () => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext(component: string): ModalContextValue {
  const context = useContext(ModalContext);
  if (!context) throw new Error(`${component} moet binnen <Modal> gebruikt worden.`);
  return context;
}

export const modalSizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

export type ModalSize = keyof typeof modalSizes;

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  /** Klik naast het venster sluit standaard; zet uit bij formulieren met invoer. */
  closeOnBackdropClick?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Gebouwd op het native `<dialog>`-element: focus blijft in het venster,
 * Escape sluit en de achtergrond is inert. Dat scheelt een focus-trap in JS.
 * Verwacht een `<ModalHeader>` als toegankelijke naam.
 */
export function Modal({
  open,
  onClose,
  size = "md",
  closeOnBackdropClick = true,
  children,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `${useId()}-title`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (closeOnBackdropClick && event.target === dialogRef.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-0 text-fg shadow-elevated",
        "backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        modalSizes[size],
        className,
      )}
    >
      <ModalContext.Provider value={{ titleId, onClose }}>
        {open ? children : null}
      </ModalContext.Provider>
    </dialog>
  );
}

export type ModalHeaderProps = ComponentProps<"div"> & {
  title: ReactNode;
  description?: ReactNode;
  /** Verberg de sluitknop als sluiten alleen via een actie mag. */
  showClose?: boolean;
};

export function ModalHeader({
  title,
  description,
  showClose = true,
  className,
  ...props
}: ModalHeaderProps) {
  const { titleId, onClose } = useModalContext("ModalHeader");

  return (
    <div
      className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-4", className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 id={titleId} className="text-base font-semibold tracking-tight text-fg">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {showClose ? (
        <IconButton label="Sluiten" variant="ghost" size="icon-sm" onClick={onClose}>
          <X />
        </IconButton>
      ) : null}
    </div>
  );
}

export function ModalBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("max-h-[70svh] overflow-y-auto px-5 py-4", className)} {...props} />;
}

export function ModalFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
