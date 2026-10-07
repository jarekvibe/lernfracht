// Datei zum Herunterladen anbieten (Blob, kein Netzwerk). Auf iOS öffnet .ics direkt den Kalender-Import.

/**
 * @param {string} filename
 * @param {string} mime
 * @param {string} text
 */
export function downloadText(filename, mime, text) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
