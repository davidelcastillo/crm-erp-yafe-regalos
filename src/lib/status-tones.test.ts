/**
 * Regla de color de los badges de estado de sucursal (pedido del usuario:
 * «apliquemos regla de colores 4:1 3:1, apliquemos colores para diferenciar
 * cada caso»).
 *
 * WCAG 2.1 AA: el texto de estos badges es chico (11-12px), así que necesita
 * **4.5:1** sobre su fondo; **3:1** es el piso para texto grande y para lo no
 * textual. Se toma 4.5:1, que es el requisito más estricto de los dos.
 */
import { BRANCH_STATUS_TONES } from './status-tones'

/** Luminancia relativa WCAG 2.1 de un color hex #rrggbb. */
const luminance = (hex: string) => {
  const canales = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lineales = canales.map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * lineales[0] + 0.7152 * lineales[1] + 0.0722 * lineales[2]
}

/** Razón de contraste WCAG entre dos colores hex. */
const contrast = (a: string, b: string) => {
  const [claro, oscuro] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

const casos = Object.entries(BRANCH_STATUS_TONES)

describe('tonos de estado de sucursal', () => {
  it('cada caso tiene un color de fondo propio', () => {
    const fondos = casos.map(([, tono]) => tono.background)

    expect(new Set(fondos).size).toBe(fondos.length)
  })

  it('el texto de cada badge llega a 4.5:1 sobre su propio fondo', () => {
    const midiendo = (umbral: number) =>
      casos
        .filter(([, tono]) => contrast(tono.color, tono.background) < umbral)
        .map(([caso]) => caso)

    expect(midiendo(4.5)).toEqual([])
  })

  it('no alcanza con el piso de 3:1: se exige 4.5 para este tamaño de texto', () => {
    // Un par que solo llegaría al piso de texto grande queda afuera.
    const midiendo = (umbral: number) =>
      casos.filter(([, tono]) => contrast(tono.color, tono.background) < umbral)

    expect(midiendo(3)).toEqual([])
    // Los tres pares actuales están cómodos arriba del umbral.
    casos.forEach(([, tono]) => {
      expect(contrast(tono.color, tono.background)).toBeGreaterThan(4.5)
    })
  })
})
