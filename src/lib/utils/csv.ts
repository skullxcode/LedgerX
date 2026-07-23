/**
 * Utility function to export structured data array into a downloadable CSV file.
 * Handles string escaping, quotes, commas, and UTF-8 encoding.
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number | undefined | null)[][]) {
  const sanitize = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(h => sanitize(h)).join(','),
    ...rows.map(row => row.map(cell => sanitize(cell)).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
