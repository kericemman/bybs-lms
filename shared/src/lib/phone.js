import { getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import { COUNTRY_CODES, DEFAULT_COUNTRY, DEFAULT_COUNTRY_CODE } from "../constants/countryCodes.js";

const sortedCodes = [...COUNTRY_CODES].sort((left, right) => right.code.length - left.code.length);

function resolveCountry(countryOrCode = DEFAULT_COUNTRY) {
  const value = String(countryOrCode || "").trim();

  if (/^[A-Z]{2}$/.test(value)) {
    return value;
  }

  if (value.startsWith("+")) {
    return sortedCodes.find((item) => item.code === value)?.countryCode || DEFAULT_COUNTRY;
  }

  return DEFAULT_COUNTRY;
}

function callingCodeForCountry(country = DEFAULT_COUNTRY) {
  try {
    return `+${getCountryCallingCode(country)}`;
  } catch {
    return DEFAULT_COUNTRY_CODE;
  }
}

export function splitPhoneNumber(value = "", fallbackCountry = DEFAULT_COUNTRY) {
  const trimmed = String(value || "").trim();
  const fallbackCountryCode = resolveCountry(fallbackCountry);
  const fallbackCallingCode = callingCodeForCountry(fallbackCountryCode);

  if (!trimmed) {
    return { country: fallbackCountryCode, countryCode: fallbackCallingCode, nationalNumber: "" };
  }

  const parsed = parsePhoneNumberFromString(trimmed, fallbackCountryCode);

  if (parsed) {
    const country = parsed.country || fallbackCountryCode;
    return {
      country,
      countryCode: `+${parsed.countryCallingCode}`,
      nationalNumber: parsed.nationalNumber || ""
    };
  }

  const matchingCode = sortedCodes.find((item) => trimmed.replace(/\s/g, "").startsWith(item.code));

  if (matchingCode) {
    return {
      country: matchingCode.countryCode,
      countryCode: matchingCode.code,
      nationalNumber: trimmed.slice(matchingCode.code.length).replace(/^[\s-]+/, "")
    };
  }

  const unknownCode = trimmed.match(/^\+\d{1,4}/)?.[0];

  if (unknownCode) {
    return {
      country: fallbackCountryCode,
      countryCode: unknownCode,
      nationalNumber: trimmed.slice(unknownCode.length).replace(/^[\s-]+/, "")
    };
  }

  return { country: fallbackCountryCode, countryCode: fallbackCallingCode, nationalNumber: trimmed };
}

export function normalizePhoneNumber(nationalNumber = "", countryOrCode = DEFAULT_COUNTRY) {
  const rawValue = String(nationalNumber || "").trim();

  if (!rawValue) return "";

  const country = resolveCountry(countryOrCode);
  const parsed = parsePhoneNumberFromString(rawValue, country);

  if (parsed?.number) {
    return parsed.number;
  }

  const digits = rawValue.replace(/[^\d]/g, "");

  if (!digits) return "";

  return `${callingCodeForCountry(country)}${digits.replace(/^0+/, "")}`;
}

export function formatInternationalPhone(value = "") {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "Not set";

  const parsed = parsePhoneNumberFromString(trimmed);

  if (parsed) {
    return parsed.formatInternational();
  }

  const { countryCode, nationalNumber } = splitPhoneNumber(trimmed);
  return nationalNumber ? `${countryCode} ${nationalNumber}` : countryCode;
}
