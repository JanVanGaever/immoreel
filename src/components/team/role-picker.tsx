"use client";

import { ChoiceGroup, Radio } from "@/components/ui/checkbox";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import type { Role } from "@/types";

export type RolePickerProps = {
  name: string;
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
  legend?: string;
  /** Rollen die niet gekozen mogen worden, met de reden als tooltip. */
  unavailable?: Partial<Record<Role, string>>;
};

/**
 * De rol kiezen, met bij elke rol wat ze mag.
 *
 * Bewust radio's en geen keuzelijst: dit is de plek waar iemand beslist wat
 * een collega met het kantoor kan doen, en dan hoort de uitleg naast de keuze
 * te staan in plaats van achter een klik. Drie rollen passen daar ook gewoon
 * in.
 */
export function RolePicker({
  name,
  value,
  onChange,
  disabled = false,
  legend,
  unavailable,
}: RolePickerProps) {
  return (
    <ChoiceGroup legend={legend} className="gap-3">
      {ROLES.map((role) => {
        const blocked = unavailable?.[role];

        return (
          <Radio
            key={role}
            name={name}
            value={role}
            checked={value === role}
            disabled={disabled || Boolean(blocked)}
            onChange={() => onChange(role)}
            label={ROLE_LABELS[role]}
            description={blocked ?? ROLE_DESCRIPTIONS[role]}
          />
        );
      })}
    </ChoiceGroup>
  );
}
