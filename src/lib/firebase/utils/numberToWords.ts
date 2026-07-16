export function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n: number): string => {
    let word = '';
    if (n > 99) {
      word += a[Math.floor(n / 100)] + 'Hundred ';
      n %= 100;
    }
    if (n > 19) {
      word += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      word += a[n];
    }
    return word;
  };

  const convertIndian = (n: number): string => {
    if (n === 0) return '';
    let word = '';
    
    // Crore
    if (n >= 10000000) {
      word += convertLessThanOneThousand(Math.floor(n / 10000000)) + 'Crore ';
      n %= 10000000;
    }
    
    // Lakh
    if (n >= 100000) {
      word += convertLessThanOneThousand(Math.floor(n / 100000)) + 'Lakh ';
      n %= 100000;
    }
    
    // Thousand
    if (n >= 1000) {
      word += convertLessThanOneThousand(Math.floor(n / 1000)) + 'Thousand ';
      n %= 1000;
    }
    
    // Hundreds & units
    if (n > 0) {
      word += convertLessThanOneThousand(n);
    }
    
    return word;
  };

  const integerPart = Math.floor(num);
  const fractionalPart = Math.round((num - integerPart) * 100);

  let result = convertIndian(integerPart);
  
  if (fractionalPart > 0) {
    result += 'and ' + convertLessThanOneThousand(fractionalPart) + 'Paise ';
  }
  
  return result.trim();
}
