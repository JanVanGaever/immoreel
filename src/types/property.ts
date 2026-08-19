import type { ID, Timestamps } from "@/types/common";

export type PropertyType =
  | "huis"
  | "appartement"
  | "grond"
  | "kantoor"
  | "handelspand"
  | "garage"
  | "overig";

export type ListingKind = "te-koop" | "te-huur";

export type BelgianRegion = "vlaanderen" | "brussel" | "wallonie";

export type Address = {
  street: string;
  number: string;
  box?: string | null;
  postalCode: string;
  city: string;
  region: BelgianRegion;
  country: "BE";
};

export type Property = {
  id: ID;
  organisationId: ID;
  reference: string;
  title: string;
  type: PropertyType;
  listingKind: ListingKind;
  address: Address;
  priceInCents?: number | null;
  bedrooms?: number | null;
  livingAreaM2?: number | null;
  plotAreaM2?: number | null;
  epcLabel?: string | null;
} & Timestamps;
