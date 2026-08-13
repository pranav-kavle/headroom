// Design doc §16's flight-status read: live status by flight number and date,
// via AeroDataBox (RapidAPI). No booking, no OAuth, no backfill — a lookup
// resolved fresh on every call.

interface FlightLeg {
  scheduledTime?: { local?: string };
  revisedTime?: { local?: string };
  predictedTime?: { local?: string };
  airport?: { name?: string };
}

export interface FlightStatus {
  flightNumber: string;
  airline: string | null;
  status: string;
  departure: { airport: string | null; scheduledLocal: string | null; revisedLocal: string | null };
  arrival: { airport: string | null; scheduledLocal: string | null; revisedLocal: string | null };
}

function legDetail(leg: FlightLeg | undefined) {
  const scheduledLocal = leg?.scheduledTime?.local ?? null;
  return {
    airport: leg?.airport?.name ?? null,
    scheduledLocal,
    // AeroDataBox calls it revisedTime on departure and predictedTime on
    // arrival — same idea, different field name. Fall back to the schedule
    // when neither is present yet.
    revisedLocal: leg?.revisedTime?.local ?? leg?.predictedTime?.local ?? scheduledLocal,
  };
}

export function parseFlightStatus(json: unknown, flightNumber: string): FlightStatus {
  const legs = json as Array<Record<string, unknown>>;
  const leg = Array.isArray(legs) ? legs[0] : undefined;
  if (!leg) {
    throw new Error(`No flight found for "${flightNumber}" on that date.`);
  }

  return {
    flightNumber: leg.number as string,
    airline: (leg.airline as { name?: string } | undefined)?.name ?? null,
    status: leg.status as string,
    departure: legDetail(leg.departure as FlightLeg),
    arrival: legDetail(leg.arrival as FlightLeg),
  };
}

export async function fetchFlightStatus(input: {
  flightNumber: string;
  date: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<FlightStatus> {
  if (!input.apiKey) {
    throw new Error("RapidAPI key is not configured — cannot look up flight status.");
  }
  const fetchImpl = input.fetchImpl ?? fetch;

  const response = await fetchImpl(
    `https://aerodatabox.p.rapidapi.com/flights/number/${input.flightNumber}/${input.date}`,
    {
      headers: {
        "x-rapidapi-key": input.apiKey,
        "x-rapidapi-host": "aerodatabox.p.rapidapi.com",
      },
    },
  );
  return parseFlightStatus(await response.json(), input.flightNumber);
}
