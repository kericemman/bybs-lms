import { useEffect, useMemo, useState } from "react";
import { COUNTRY_CODES, DEFAULT_COUNTRY } from "../constants/countryCodes.js";
import { normalizePhoneNumber, splitPhoneNumber } from "../lib/phone.js";

const selectClassName =
  "h-10 min-w-0 rounded-md border border-bybs-border bg-white px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";
const inputClassName =
  "h-10 min-w-0 flex-1 rounded-md border border-bybs-border px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

export function PhoneInput({ value = "", onChange, disabled = false, required = false, placeholder = "712345678" }) {
  const parsed = useMemo(() => splitPhoneNumber(value), [value]);
  const [country, setCountry] = useState(parsed.country || DEFAULT_COUNTRY);

  useEffect(() => {
    if (value) {
      setCountry(parsed.country || DEFAULT_COUNTRY);
    }
  }, [parsed.country, value]);

  function handleCountryChange(event) {
    const nextCountry = event.target.value;
    setCountry(nextCountry);

    if (parsed.nationalNumber) {
      onChange?.(normalizePhoneNumber(parsed.nationalNumber, nextCountry));
    }
  }

  function handleNumberChange(event) {
    onChange?.(normalizePhoneNumber(event.target.value, country));
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row">
      <select
        aria-label="Country code"
        className={`${selectClassName} w-full sm:w-36 sm:shrink-0`}
        disabled={disabled}
        onChange={handleCountryChange}
        value={country}
      >
        {!COUNTRY_CODES.some((item) => item.countryCode === country) ? (
          <option value={country}>{parsed.countryCode} Custom</option>
        ) : null}
        {COUNTRY_CODES.map((item) => (
          <option key={item.countryCode} value={item.countryCode}>
            {item.code} {item.country}
          </option>
        ))}
      </select>
      <input
        className={inputClassName}
        disabled={disabled}
        inputMode="tel"
        onChange={handleNumberChange}
        placeholder={placeholder}
        required={required}
        type="tel"
        value={parsed.nationalNumber}
      />
    </div>
  );
}
