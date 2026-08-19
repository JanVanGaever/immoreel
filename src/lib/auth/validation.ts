/**
 * Validatie van auth-formulieren. Bewust zonder schema-library: het gaat om
 * een handvol velden, en dezelfde functies draaien op client en server.
 *
 * De server valideert altijd opnieuw; de client gebruikt dit alleen om
 * dezelfde meldingen te tonen zonder rondje naar de server.
 */

export type FieldErrors<Field extends string = string> = Partial<Record<Field, string>>;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

/** Bewust ruim: strengere regexes weren geldige adressen. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();

  if (!email) return "Vul je e-mailadres in.";
  if (email.length > 254) return "Dit e-mailadres is te lang.";
  if (!EMAIL_PATTERN.test(email)) return "Dit lijkt geen geldig e-mailadres.";

  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return "Kies een wachtwoord.";
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Gebruik minstens ${PASSWORD_MIN_LENGTH} tekens.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) return "Dit wachtwoord is te lang.";
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return "Gebruik minstens één letter en één cijfer.";
  }

  return undefined;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | undefined {
  if (!confirmation) return "Herhaal je wachtwoord.";
  if (password !== confirmation) return "De wachtwoorden komen niet overeen.";

  return undefined;
}

export function validateName(value: string): string | undefined {
  const name = value.trim();

  if (!name) return "Vul je naam in.";
  if (name.length < 2) return "Vul je volledige naam in.";
  if (name.length > 80) return "Deze naam is te lang.";

  return undefined;
}

export function validateOrganisationName(value: string): string | undefined {
  const name = value.trim();

  if (!name) return "Vul de naam van je kantoor in.";
  if (name.length < 2) return "Deze naam is te kort.";
  if (name.length > 80) return "Deze naam is te lang.";

  return undefined;
}

/** Haalt een tekstveld uit een FormData; alles wat geen string is wordt "". */
export function readField(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
