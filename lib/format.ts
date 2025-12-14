/**
 * Utility functions for formatting numbers with locale
 * Uses 'en-IN' locale for Indian number formatting
 */

/**
 * Format currency amount with Indian locale
 * @param amount - The amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with ₹ symbol
 */
export const formatCurrency = (amount: number | string | null | undefined, decimals: number = 2): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  if (isNaN(num)) return '₹0.00';
  
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
};

/**
 * Format quantity with Indian locale
 * @param quantity - The quantity to format
 * @param decimals - Number of decimal places (default: 3 for quantities)
 * @returns Formatted string
 */
export const formatQuantity = (quantity: number | string | null | undefined, decimals: number = 3): string => {
  const num = typeof quantity === 'string' ? parseFloat(quantity) : (quantity || 0);
  if (isNaN(num)) return '0';
  
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Format number with Indian locale (without currency symbol)
 * @param number - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export const formatNumber = (number: number | string | null | undefined, decimals: number = 2): string => {
  const num = typeof number === 'string' ? parseFloat(number) : (number || 0);
  if (isNaN(num)) return '0';
  
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Format percentage with Indian locale
 * @param percentage - The percentage to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with % symbol
 */
export const formatPercentage = (percentage: number | string | null | undefined, decimals: number = 2): string => {
  const num = typeof percentage === 'string' ? parseFloat(percentage) : (percentage || 0);
  if (isNaN(num)) return '0%';
  
  return `${num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}%`;
};

