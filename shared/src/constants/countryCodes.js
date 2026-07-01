import { getCountries, getCountryCallingCode } from "libphonenumber-js";

export const DEFAULT_COUNTRY = "SS";
export const DEFAULT_COUNTRY_CODE = `+${getCountryCallingCode(DEFAULT_COUNTRY)}`;

const regionNames = typeof Intl !== "undefined" && Intl.DisplayNames
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

function countryName(countryCode) {
  return regionNames?.of(countryCode) || countryCode;
}

export const COUNTRY_CODES = getCountries()
  .map((countryCode) => ({
    countryCode,
    country: countryName(countryCode),
    code: `+${getCountryCallingCode(countryCode)}`,
    callingCode: getCountryCallingCode(countryCode)
  }))
  .sort((left, right) => left.country.localeCompare(right.country));
