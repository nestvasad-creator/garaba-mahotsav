/**
 * Export CSV with UTF-8 BOM so Microsoft Excel correctly renders Gujarati Unicode scripts.
 */
export function exportToCsvWithBom(filename: string, csvContent: string): void {
  if (typeof window === 'undefined') return;

  // Prepend UTF-8 Byte Order Mark (\uFEFF)
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
