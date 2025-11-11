export const formatCurrency = (value: number, currency = 'XAF'): string => {
    try {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency,
            notation: 'standard',
            maximumFractionDigits: currency === 'XAF' ? 0 : 2,
        }).format(value);
    } catch {
        return `${value.toFixed(currency === 'XAF' ? 0 : 2)} ${currency}`;
    }
};

export default formatCurrency;


