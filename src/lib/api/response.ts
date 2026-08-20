import { NextResponse } from "next/server";
import { ApiError, type ApiErrorBody } from "@/lib/api/errors";

/**
 * De antwoorden van de API, allemaal via dezelfde twee functies.
 *
 * `no-store` staat er standaard bij en dat is een keuze, geen slordigheid:
 * alles achter deze routes hangt aan een sessie en aan een organisatie. Een
 * antwoord dat in een gedeelde cache belandt, is een project van het ene
 * kantoor in het tabblad van het andere. Wie wél wil laten cachen — een
 * afgewerkte render verandert niet meer — zet dat per route, zoals de
 * downloadroute doet.
 */

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export type JsonInit = {
  status?: number;
  headers?: HeadersInit;
};

export function jsonOk<T>(data: T, init: JsonInit = {}): NextResponse<T> {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: { ...NO_STORE, ...headersOf(init.headers) },
  });
}

/** 201 met de plek van het nieuwe ding erbij; scheelt een tweede aanroep. */
export function jsonCreated<T>(data: T, location?: string): NextResponse<T> {
  return jsonOk(data, {
    status: 201,
    headers: location ? { Location: location } : undefined,
  });
}

export function jsonError(error: ApiError): NextResponse<ApiErrorBody> {
  return NextResponse.json(error.toBody(), {
    status: error.status,
    headers: NO_STORE,
  });
}

function headersOf(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};

  return Object.fromEntries(new Headers(headers).entries());
}
