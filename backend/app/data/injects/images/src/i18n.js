// Fills a mock-up in the language asked for (?lang=es): every element
// with a data-es attribute carries its Spanish text; English is inline.
const lang = new URLSearchParams(location.search).get('lang') === 'es' ? 'es' : 'en'
document.documentElement.lang = lang
if (lang === 'es') {
  for (const el of document.querySelectorAll('[data-es]')) el.innerHTML = el.dataset.es
}
