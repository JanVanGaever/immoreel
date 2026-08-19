"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";

export type PasswordInputProps = Omit<InputProps, "type" | "trailingIcon">;

/**
 * Wachtwoordveld met een oogje om de invoer te tonen. Scheelt fouten bij
 * lange wachtwoorden, zeker op mobiel.
 */
export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      trailingIcon={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
          title={visible ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
          className="flex items-center rounded-sm text-fg-subtle transition-colors hover:text-fg"
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      }
    />
  );
}
