/**
 * Renders an IANA zone the way the /welcome card shows it: "New York · UTC−4".
 *
 * The zone is read off the browser and shown for correction rather than asked
 * for, so this has to survive a value Intl does not recognise — an unknown zone
 * loses its offset, not the whole card.
 */
export function describeTimeZone(
  zone: string,
  now: Date = new Date(),
): { city: string; offset: string } {
  const city = zone.split("/").pop()?.replace(/_/g, " ") ?? zone;

  try {
    const name =
      new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value ?? "";
    // "GMT-4" → "UTC−4", with U+2212 so the minus matches the digit weight.
    const offset = name.replace("GMT", "UTC").replace("-", "−");
    return { city, offset: offset === "UTC" ? "UTC+0" : offset };
  } catch {
    return { city, offset: "" };
  }
}

/** Every zone the runtime knows, for the "Change" picker. */
export function listTimeZones(): string[] {
  const supported = Intl.supportedValuesOf?.("timeZone");
  return supported && supported.length > 0 ? [...supported] : ["UTC"];
}

/** The browser's own guess, which is what we show first. */
export function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
