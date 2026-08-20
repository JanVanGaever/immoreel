import type { ID, Timestamps } from "@/types/common";

/**
 * De huisstijl van een vastgoedkantoor.
 *
 * Dit is het niveau erboven `BrandingSettings` (`src/types/video.ts`): de kit
 * hoort bij de organisatie en geldt voor élk project, de instellingen van een
 * project zeggen alleen waar ze daarvan afwijken. Eén kit per organisatie —
 * een kantoor dat met twee merken werkt, komt later aan bod, en dan is dit een
 * lijst in plaats van een record.
 */

export type BrandFontId =
  | "inter"
  | "dm-sans"
  | "space-grotesk"
  | "source-serif"
  | "libre-baskerville";

/**
 * Wat er op de eindkaart onder de oproep komt te staan. Alle velden zijn
 * optioneel-als-lege-string: een kantoor dat geen website heeft, laat die
 * regel gewoon weg in plaats van er `null` in te moeten zetten.
 */
export type BrandContact = {
  /** Naam van het kantoor of van de makelaar zelf. */
  agentName: string;
  phone: string;
  email: string;
  website: string;
};

export type BrandKit = {
  id: ID;
  organisationId: ID;
  /** URL in de opslag; `null` zolang er geen logo geüpload is. */
  logoUrl: string | null;
  logoFileName: string | null;
  /** Hex met hekje. Draagt de eindkaart en de titelkaart. */
  primaryColor: string;
  /** Hex met hekje. Accentlijn en de knop op de eindkaart. */
  secondaryColor: string;
  /** De zin boven de contactgegevens: "Benieuwd naar dit pand?" */
  outroText: string;
  /** De oproep zelf: "Bel voor een bezichtiging". */
  ctaText: string;
  contact: BrandContact;
  fontId: BrandFontId;
  /** Of het logo standaard over elke video ligt. Per project te overrulen. */
  watermarkByDefault: boolean;
} & Timestamps;

/** Wat het formulier verstuurt: de kit zonder wat de server zelf invult. */
export type BrandKitInput = Omit<
  BrandKit,
  "id" | "organisationId" | "createdAt" | "updatedAt"
>;

/**
 * De huisstijl zoals preview en render ze zien: de kit met de afwijkingen van
 * het project er al in verwerkt, plus de kleuren die eruit volgen. Wie hiermee
 * werkt, hoeft niet meer te weten wát overruled was.
 */
export type ResolvedBrand = {
  logoUrl: string | null;
  /** Twee letters als er geen logobestand is. */
  logoInitials: string;
  primaryColor: string;
  secondaryColor: string;
  /** Leesbare tekstkleur op `primaryColor`. */
  onPrimaryColor: string;
  onSecondaryColor: string;
  outroText: string;
  ctaText: string;
  contact: BrandContact;
  fontId: BrandFontId;
  /** CSS `font-family`-stack die bij `fontId` hoort. */
  fontStack: string;
  showWatermark: boolean;
};
