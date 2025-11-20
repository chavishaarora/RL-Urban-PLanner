/**
 * Get currency information based on location
 */
export interface CurrencyInfo {
    code: string; // e.g., "USD", "INR", "EUR"
    symbol: string; // e.g., "$", "₹", "€"
    name: string; // e.g., "US Dollar", "Indian Rupee"
}

const COUNTRY_CURRENCY_MAP: { [key: string]: CurrencyInfo } = {
    // North America
    'US': { code: 'USD', symbol: '$', name: 'US Dollar' },
    'USA': { code: 'USD', symbol: '$', name: 'US Dollar' },
    'United States': { code: 'USD', symbol: '$', name: 'US Dollar' },
    'CA': { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
    'Canada': { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
    'MX': { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
    'Mexico': { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
    
    // Europe - Eurozone
    'DE': { code: 'EUR', symbol: '€', name: 'Euro' },
    'Germany': { code: 'EUR', symbol: '€', name: 'Euro' },
    'FR': { code: 'EUR', symbol: '€', name: 'Euro' },
    'France': { code: 'EUR', symbol: '€', name: 'Euro' },
    'ES': { code: 'EUR', symbol: '€', name: 'Euro' },
    'Spain': { code: 'EUR', symbol: '€', name: 'Euro' },
    'IT': { code: 'EUR', symbol: '€', name: 'Euro' },
    'Italy': { code: 'EUR', symbol: '€', name: 'Euro' },
    'NL': { code: 'EUR', symbol: '€', name: 'Euro' },
    'Netherlands': { code: 'EUR', symbol: '€', name: 'Euro' },
    'BE': { code: 'EUR', symbol: '€', name: 'Euro' },
    'Belgium': { code: 'EUR', symbol: '€', name: 'Euro' },
    'PT': { code: 'EUR', symbol: '€', name: 'Euro' },
    'Portugal': { code: 'EUR', symbol: '€', name: 'Euro' },
    'AT': { code: 'EUR', symbol: '€', name: 'Euro' },
    'Austria': { code: 'EUR', symbol: '€', name: 'Euro' },
    'IE': { code: 'EUR', symbol: '€', name: 'Euro' },
    'Ireland': { code: 'EUR', symbol: '€', name: 'Euro' },
    'GR': { code: 'EUR', symbol: '€', name: 'Euro' },
    'Greece': { code: 'EUR', symbol: '€', name: 'Euro' },
    'FI': { code: 'EUR', symbol: '€', name: 'Euro' },
    'Finland': { code: 'EUR', symbol: '€', name: 'Euro' },
    
    // Europe - Non-Eurozone
    'GB': { code: 'GBP', symbol: '£', name: 'British Pound' },
    'UK': { code: 'GBP', symbol: '£', name: 'British Pound' },
    'United Kingdom': { code: 'GBP', symbol: '£', name: 'British Pound' },
    'CH': { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
    'Switzerland': { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
    'NO': { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
    'Norway': { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
    'SE': { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
    'Sweden': { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
    'DK': { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
    'Denmark': { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
    
    // Asia
    'IN': { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    'India': { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    'JP': { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    'Japan': { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    'CN': { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
    'China': { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
    'KR': { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
    'South Korea': { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
    'SG': { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    'Singapore': { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    'HK': { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
    'Hong Kong': { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
    'TH': { code: 'THB', symbol: '฿', name: 'Thai Baht' },
    'Thailand': { code: 'THB', symbol: '฿', name: 'Thai Baht' },
    'MY': { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
    'Malaysia': { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
    'ID': { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
    'Indonesia': { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
    'PH': { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
    'Philippines': { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
    'VN': { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
    'Vietnam': { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
    
    // Middle East
    'AE': { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    'UAE': { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    'Dubai': { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    'Abu Dhabi': { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    'SA': { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
    'Saudi Arabia': { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
    'QA': { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal' },
    'Qatar': { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal' },
    'KW': { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' },
    'Kuwait': { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' },
    'OM': { code: 'OMR', symbol: 'ر.ع', name: 'Omani Rial' },
    'Oman': { code: 'OMR', symbol: 'ر.ع', name: 'Omani Rial' },
    'IL': { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
    'Israel': { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
    'TR': { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
    'Turkey': { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
    
    // Oceania
    'AU': { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    'Australia': { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    'NZ': { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
    'New Zealand': { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
    
    // Latin America
    'BR': { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    'Brazil': { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    'AR': { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
    'Argentina': { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
    'CL': { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso' },
    'Chile': { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso' },
    'CO': { code: 'COP', symbol: 'CO$', name: 'Colombian Peso' },
    'Colombia': { code: 'COP', symbol: 'CO$', name: 'Colombian Peso' },
    'PE': { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
    'Peru': { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
    'UY': { code: 'UYU', symbol: 'UY$', name: 'Uruguayan Peso' },
    'Uruguay': { code: 'UYU', symbol: 'UY$', name: 'Uruguayan Peso' },
    'VE': { code: 'VES', symbol: 'Bs.', name: 'Venezuelan Bolívar' },
    'Venezuela': { code: 'VES', symbol: 'Bs.', name: 'Venezuelan Bolívar' },
    
    // Africa
    'ZA': { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    'South Africa': { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    'EG': { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
    'Egypt': { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
    'NG': { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
    'Nigeria': { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
    'KE': { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
    'Kenya': { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
};

const DEFAULT_CURRENCY: CurrencyInfo = {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar'
};

/**
 * Detect currency based on location name
 */
export function getCurrencyFromLocation(locationName: string): CurrencyInfo {
    if (!locationName) return DEFAULT_CURRENCY;
    
    const normalizedLocation = locationName.trim();
    
    // Try to detect from city names FIRST (before country codes to avoid substring matches)
    const cityCountryMap: { [key: string]: string } = {
        // India
        'Mumbai': 'India',
        'Delhi': 'India',
        'Bangalore': 'India',
        'Chennai': 'India',
        'Kolkata': 'India',
        'Hyderabad': 'India',
        'Pune': 'India',
        'Ahmedabad': 'India',
        'Gurgaon': 'India',
        'Noida': 'India',
        
        // Japan
        'Tokyo': 'Japan',
        'Osaka': 'Japan',
        'Kyoto': 'Japan',
        'Yokohama': 'Japan',
        'Nagoya': 'Japan',
        'Sapporo': 'Japan',
        'Fukuoka': 'Japan',
        
        // Australia
        'Sydney': 'Australia',
        'Melbourne': 'Australia',
        'Brisbane': 'Australia',
        'Perth': 'Australia',
        'Adelaide': 'Australia',
        'Canberra': 'Australia',
        
        // South Africa
        'Cape Town': 'South Africa',
        'Johannesburg': 'South Africa',
        'Durban': 'South Africa',
        'Pretoria': 'South Africa',
        
        // Netherlands
        'Amsterdam': 'Netherlands',
        'Rotterdam': 'Netherlands',
        'The Hague': 'Netherlands',
        'Utrecht': 'Netherlands',
        
        // Latin America - Brazil
        'São Paulo': 'Brazil',
        'Rio de Janeiro': 'Brazil',
        'Brasília': 'Brazil',
        'Salvador': 'Brazil',
        'Belo Horizonte': 'Brazil',
        
        // Latin America - Argentina
        'Buenos Aires': 'Argentina',
        'Córdoba': 'Argentina',
        'Rosario': 'Argentina',
        'Mendoza': 'Argentina',
        
        // Latin America - Chile
        'Santiago': 'Chile',
        'Valparaíso': 'Chile',
        'Concepción': 'Chile',
        
        // Latin America - Colombia
        'Bogotá': 'Colombia',
        'Medellín': 'Colombia',
        'Cali': 'Colombia',
        'Cartagena': 'Colombia',
        
        // Latin America - Peru
        'Lima': 'Peru',
        'Cusco': 'Peru',
        'Arequipa': 'Peru',
        
        // Latin America - Other
        'Montevideo': 'Uruguay',
        'Caracas': 'Venezuela',
        'Mexico City': 'Mexico',
        'Guadalajara': 'Mexico',
        'Monterrey': 'Mexico',
        
        // Middle East - UAE
        'Dubai': 'UAE',
        'Abu Dhabi': 'UAE',
        'Sharjah': 'UAE',
        
        // Middle East - Saudi Arabia
        'Riyadh': 'Saudi Arabia',
        'Jeddah': 'Saudi Arabia',
        'Mecca': 'Saudi Arabia',
        'Medina': 'Saudi Arabia',
        
        // Middle East - Other
        'Doha': 'Qatar',
        'Kuwait City': 'Kuwait',
        'Muscat': 'Oman',
        'Tel Aviv': 'Israel',
        'Jerusalem': 'Israel',
        'Istanbul': 'Turkey',
        'Ankara': 'Turkey',
        'Izmir': 'Turkey',
        
        // USA
        'New York': 'USA',
        'Los Angeles': 'USA',
        'Chicago': 'USA',
        'San Francisco': 'USA',
        'Boston': 'USA',
        'Seattle': 'USA',
        'Miami': 'USA',
        'Washington': 'USA',
        
        // UK
        'London': 'UK',
        'Manchester': 'UK',
        'Edinburgh': 'UK',
        'Birmingham': 'UK',
        'Glasgow': 'UK',
        
        // Europe - Spain
        'Madrid': 'Spain',
        'Barcelona': 'Spain',
        'Valencia': 'Spain',
        'Seville': 'Spain',
        'Bilbao': 'Spain',
        'Málaga': 'Spain',
        
        // Europe - France
        'Paris': 'France',
        'Lyon': 'France',
        'Marseille': 'France',
        'Nice': 'France',
        
        // Europe - Germany
        'Berlin': 'Germany',
        'Munich': 'Germany',
        'Frankfurt': 'Germany',
        'Hamburg': 'Germany',
        'Cologne': 'Germany',
        
        // Europe - Italy
        'Rome': 'Italy',
        'Milan': 'Italy',
        'Florence': 'Italy',
        'Venice': 'Italy',
        'Naples': 'Italy',
        
        // Europe - Other Eurozone
        'Brussels': 'Belgium',
        'Antwerp': 'Belgium',
        'Lisbon': 'Portugal',
        'Porto': 'Portugal',
        'Vienna': 'Austria',
        'Dublin': 'Ireland',
        'Cork': 'Ireland',
        'Athens': 'Greece',
        'Helsinki': 'Finland',
        
        // Europe - Non-Eurozone
        'Zurich': 'Switzerland',
        'Geneva': 'Switzerland',
        'Bern': 'Switzerland',
        'Oslo': 'Norway',
        'Stockholm': 'Sweden',
        'Copenhagen': 'Denmark',
        
        // Canada
        'Toronto': 'Canada',
        'Vancouver': 'Canada',
        'Montreal': 'Canada',
        'Calgary': 'Canada',
        
        // Other Asia
        'Seoul': 'South Korea',
        'Busan': 'South Korea',
        'Shanghai': 'China',
        'Beijing': 'China',
        'Hong Kong': 'Hong Kong',
        'Singapore': 'Singapore',
        'Bangkok': 'Thailand',
        'Kuala Lumpur': 'Malaysia',
        'Jakarta': 'Indonesia',
        'Manila': 'Philippines',
        'Hanoi': 'Vietnam',
        'Ho Chi Minh City': 'Vietnam',
        
        // New Zealand
        'Auckland': 'New Zealand',
        'Wellington': 'New Zealand',
        'Christchurch': 'New Zealand',
        
        // Africa
        'Cairo': 'Egypt',
        'Lagos': 'Nigeria',
        'Nairobi': 'Kenya',
    };
    
    for (const [city, country] of Object.entries(cityCountryMap)) {
        if (normalizedLocation.includes(city)) {
            return COUNTRY_CURRENCY_MAP[country] || DEFAULT_CURRENCY;
        }
    }
    
    // Then try country codes/names (after cities to avoid false matches like "CA" in "Barcelona")
    for (const [key, currency] of Object.entries(COUNTRY_CURRENCY_MAP)) {
        if (normalizedLocation.toLowerCase().includes(key.toLowerCase())) {
            return currency;
        }
    }
    
    return DEFAULT_CURRENCY;
}

/**
 * Format currency value with proper symbol and formatting
 */
export function formatCurrency(value: number, currency: CurrencyInfo, decimals: number = 0): string {
    const formattedValue = value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
    
    // Symbols that go BEFORE the amount (Western style)
    const beforeSymbols = [
        '$', '£', '€', 'CHF',  // Base currencies
        'CA$', 'A$', 'NZ$', 'S$', 'HK$',  // Dollar variants
        'MX$', 'AR$', 'CL$', 'CO$', 'UY$',  // Latin America
        'R$', 'R',  // Brazil, South Africa
        'E£', 'KSh'  // Egypt, Kenya
    ];
    
    if (beforeSymbols.includes(currency.symbol)) {
        return `${currency.symbol}${formattedValue}`;
    }
    
    // Symbols that go AFTER the amount (Asian/Middle Eastern style)
    // Includes: ₹, ¥, ₩, د.إ, ر.س, ر.ق, د.ك, ر.ع, ₪, ₺, ฿, RM, Rp, ₱, ₫, ₦, S/, Bs., kr
    return `${formattedValue} ${currency.symbol}`;
}
