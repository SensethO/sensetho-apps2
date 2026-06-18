/**
 * exportReport — moteur PDF générique réutilisable (html2canvas → jsPDF).
 *
 * Logique extraite/recopiée du moteur `exportGuidedPDF`
 * (GuidedDiagnosticPDFReport.tsx) mais rendue générique :
 *  - les pages fixes portent l'attribut [data-pdf-page]   → capturées en pleine page A4
 *  - les cartes portent l'attribut       [data-pdf-card]   → packées par page A4 sans coupure
 *
 * Le composant rapport doit être rendu hors-écran, sous un conteneur racine
 * dont l'id est passé en paramètre (rootId). Styles 100 % inline.
 *
 * A4 portrait : 210 × 297 mm. Capture scale ×2 pour la qualité print.
 */

/**
 * Capture le DOM rendu hors-écran sous `#${rootId}` via html2canvas et assemble
 * les pages en un fichier PDF A4 avec jsPDF, puis déclenche le téléchargement.
 *
 * @param rootId   id du conteneur racine contenant les pages/cartes du rapport
 * @param filename nom du fichier PDF généré
 */
export async function exportReport(rootId: string, filename: string): Promise<void> {
  // Import dynamique pour éviter d'embarquer html2canvas/jspdf côté serveur
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  // ── Paramètres A4 ────────────────────────────────────────────────────────
  const PDF_W_MM = 210
  const PDF_H_MM = 297
  const SCALE = 2 // résolution ×2 pour qualité print
  const PX_WIDTH = 794 // largeur des pages DOM (= A4 @ 96dpi)

  // mm par pixel source (avant scale)
  const mmPerPx = PDF_W_MM / PX_WIDTH

  const root = document.getElementById(rootId)
  if (!root) {
    console.error(`[exportReport] conteneur introuvable : #${rootId}`)
    return
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let pageNum = 0

  /** Capture un élément DOM et ajoute une page PDF. */
  async function addElementAsPage(el: HTMLElement, heightMM = PDF_H_MM): Promise<void> {
    const canvas = await html2canvas(el, {
      scale: SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
    const imgData = canvas.toDataURL('image/png')
    const imgH = (canvas.height / SCALE) * mmPerPx

    if (pageNum > 0) pdf.addPage()
    pageNum++
    pdf.addImage(imgData, 'PNG', 0, 0, PDF_W_MM, Math.min(imgH, heightMM))
  }

  // ── 1. Pages fixes ([data-pdf-page]) — capturées en pleine page ───────────
  const fixedPages = Array.from(
    root.querySelectorAll<HTMLElement>('[data-pdf-page]'),
  ).sort((a, b) => {
    const ka = a.getAttribute('data-pdf-page') ?? ''
    const kb = b.getAttribute('data-pdf-page') ?? ''
    return ka.localeCompare(kb)
  })

  for (const page of fixedPages) {
    await addElementAsPage(page)
  }

  // ── 2. Cartes ([data-pdf-card]) — packing par page sans coupure ───────────
  const cards = Array.from(
    root.querySelectorAll<HTMLElement>('[data-pdf-card]'),
  ).sort((a, b) => {
    const ka = a.getAttribute('data-pdf-card') ?? ''
    const kb = b.getAttribute('data-pdf-card') ?? ''
    return ka.localeCompare(kb)
  })

  if (cards.length > 0) {
    // Hauteur disponible par page de cartes (marges haut + bas = 12 mm chacune)
    const MARGIN_MM = 12
    const AVAIL_H_MM = PDF_H_MM - MARGIN_MM * 2

    // Grouper les cartes par page en respectant la hauteur max
    const groups: HTMLElement[][] = []
    let currentGroup: HTMLElement[] = []
    let currentHMM = 0

    for (const card of cards) {
      const cardHPx = card.getBoundingClientRect().height || card.offsetHeight
      const cardHMM = cardHPx * mmPerPx

      if (currentHMM + cardHMM > AVAIL_H_MM && currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup = [card]
        currentHMM = cardHMM
      } else {
        currentGroup.push(card)
        currentHMM += cardHMM
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup)

    // Pour chaque groupe : créer un wrapper temporaire, cloner, capturer, supprimer
    for (const group of groups) {
      const wrapper = document.createElement('div')
      wrapper.style.cssText = [
        'position:absolute',
        'left:-9999px',
        'top:0',
        'width:794px',
        'background:#ffffff',
        'box-sizing:border-box',
        'padding:12px 0',
      ].join(';')

      group.forEach(card => {
        const clone = card.cloneNode(true) as HTMLElement
        wrapper.appendChild(clone)
      })

      document.body.appendChild(wrapper)
      await addElementAsPage(wrapper)
      document.body.removeChild(wrapper)
    }
  }

  // ── 3. Téléchargement ──────────────────────────────────────────────────────
  pdf.save(filename)
}
