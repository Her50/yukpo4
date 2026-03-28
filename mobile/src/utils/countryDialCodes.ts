import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

export interface CountryDialCode {
  code: string;
  prefix: string;
  label: string;
}

const getFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  return countryCode
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('');
};

export const getAllCountryDialCodes = (preferredCountryCode = 'CM'): CountryDialCode[] => {
  const allCountries = getCountries()
    .filter((countryCode) => {
      try {
        getCountryCallingCode(countryCode);
        return true;
      } catch {
        return false;
      }
    })
    .map((countryCode) => ({
      code: countryCode,
      prefix: `+${getCountryCallingCode(countryCode)}`,
      label: `${getFlagEmoji(countryCode)} ${countryCode}`,
    }))
    .sort((a, b) => {
      const prefixDiff = Number(a.prefix.slice(1)) - Number(b.prefix.slice(1));
      if (prefixDiff !== 0) return prefixDiff;
      return a.code.localeCompare(b.code);
    });

  const preferredIndex = allCountries.findIndex((country) => country.code === preferredCountryCode);
  if (preferredIndex > 0) {
    const [preferredCountry] = allCountries.splice(preferredIndex, 1);
    allCountries.unshift(preferredCountry);
  }

  return allCountries;
};
