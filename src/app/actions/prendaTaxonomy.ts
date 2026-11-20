// src/app/actions/prendaTaxonomy.ts
'use server';
import { requireAdmin } from "@/lib/auth-guard";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  createTaxonomySchema,
  createCategoriaPrendaSchema,
  renameTaxonomySchema,
  setTaxonomyActiveSchema,
  type CategoriaPrendaOption,
  type TaxonomyOption,
} from '@/lib/validations/prendaTaxonomy';

/**
 * Taxonomías creables de prendas (U2): categoría, estilo, condición, tipo de
 * medida y canal de venta. Se crean, se renombran y se desactivan — nunca se
 * borran, porque hay prendas y pedidos que las referencian.
 *
 * Mismo contrato que `category.ts`: `requireAdmin()` primero, Zod después y un
 * `ActionResult` con mensajes en español.
 */

function isPrismaError(err: unknown, code: string): boolean {
  return (
    err instanceof Object &&
    'code' in err &&
    (err as { code: unknown }).code === code
  );
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/** Proyección mínima de cada delegate de Prisma que usan estas acciones. */
type TaxonomyDelegate<T> = {
  findFirst(args: unknown): Promise<{ id: number } | null>;
  findMany(args: unknown): Promise<T[]>;
  create(args: unknown): Promise<T>;
  update(args: unknown): Promise<T>;
};

type TaxonomyKey =
  | 'categoriaPrenda'
  | 'estiloPrenda'
  | 'condicionPrenda'
  | 'medidaTipo'
  | 'canalVenta';

type Etiqueta = { label: string; articulo: 'un' | 'una' };

const CATEGORIA: Etiqueta = { label: 'categoría de prenda', articulo: 'una' };
const ESTILO: Etiqueta = { label: 'estilo', articulo: 'un' };
const CONDICION: Etiqueta = { label: 'condición', articulo: 'una' };
const MEDIDA: Etiqueta = { label: 'tipo de medida', articulo: 'un' };
const CANAL: Etiqueta = { label: 'canal de venta', articulo: 'un' };

function delegateOf<T>(key: TaxonomyKey): TaxonomyDelegate<T> {
  // Los cinco delegates comparten la forma que usamos acá; Prisma los tipa por modelo.
  return prisma[key] as unknown as TaxonomyDelegate<T>;
}

const duplicado = (n: Etiqueta) => `Ya existe ${n.articulo} ${n.label} con ese nombre`;
const noEncontrado = (n: Etiqueta) => `No se encontró ${n.articulo} ${n.label}`;
const zodMessage = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join(', ');

/** Alta: nombre recortado, único sin distinguir mayúsculas. */
async function crear<T>(
  delegate: TaxonomyDelegate<T>,
  n: Etiqueta,
  schema: { parse: (value: unknown) => { name: string } },
  data: unknown
): Promise<ActionResult<T>> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const parsed = schema.parse(data);

    // El @unique de la tabla distingue mayúsculas: el chequeo lo hace el servidor.
    // Se compara contra todas las filas (también las inactivas): nunca se borran,
    // así que reusar un nombre solo produciría un par indistinguible en la lista.
    const existente = await delegate.findFirst({
      where: { name: { equals: parsed.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existente) return { success: false as const, error: duplicado(n) };

    const row = await delegate.create({ data: parsed });

    revalidatePath('/inventario');
    return { success: true as const, data: row };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    if (isPrismaError(error, 'P2002')) {
      return { success: false as const, error: duplicado(n) };
    }
    console.error(`Error al crear ${n.articulo} ${n.label}:`, error);
    return {
      success: false as const,
      error: `Error al crear ${n.articulo} ${n.label}`,
    };
  }
}

/** Renombrar: se rechaza si colisiona con otra fila (misma regla que el alta). */
async function renombrar<T>(
  delegate: TaxonomyDelegate<T>,
  n: Etiqueta,
  data: unknown
): Promise<ActionResult<T>> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { id, name } = renameTaxonomySchema.parse(data);

    const colision = await delegate.findFirst({
      where: {
        id: { not: id },
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (colision) return { success: false as const, error: duplicado(n) };

    const row = await delegate.update({
      where: { id },
      data: { name },
      select: { id: true, name: true },
    });

    revalidatePath('/inventario');
    return { success: true as const, data: row };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    if (isPrismaError(error, 'P2002')) {
      return { success: false as const, error: duplicado(n) };
    }
    if (isPrismaError(error, 'P2025')) {
      return { success: false as const, error: noEncontrado(n) };
    }
    console.error(`Error al renombrar ${n.articulo} ${n.label}:`, error);
    return {
      success: false as const,
      error: `Error al renombrar ${n.articulo} ${n.label}`,
    };
  }
}

/**
 * Activar/desactivar. Se permite desactivar una fila en uso: las prendas
 * existentes la conservan y solo desaparece de los selectores de alta.
 */
async function setActivo<T>(
  delegate: TaxonomyDelegate<T>,
  n: Etiqueta,
  data: unknown
): Promise<ActionResult<T>> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { id, active } = setTaxonomyActiveSchema.parse(data);

    const row = await delegate.update({
      where: { id },
      data: { active },
      select: { id: true, active: true },
    });

    revalidatePath('/inventario');
    return { success: true as const, data: row };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: zodMessage(error) };
    }
    if (isPrismaError(error, 'P2025')) {
      return { success: false as const, error: noEncontrado(n) };
    }
    console.error(
      `Error al activar/desactivar ${n.articulo} ${n.label}:`,
      error
    );
    return {
      success: false as const,
      error: `Error al activar/desactivar ${n.articulo} ${n.label}`,
    };
  }
}

/** Opciones para selectores: solo filas activas, ordenadas por nombre. */
async function opciones<T extends TaxonomyOption>(
  delegate: TaxonomyDelegate<T>,
  n: Etiqueta,
  select: Record<string, boolean>
): Promise<ActionResult<T[]>> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const rows = await delegate.findMany({
      where: { active: true },
      select,
      orderBy: { name: 'asc' },
    });
    return { success: true as const, data: rows };
  } catch (error) {
    console.error(`Error al obtener opciones de ${n.label}:`, error);
    return {
      success: false as const,
      error: `Error al obtener opciones de ${n.label}`,
    };
  }
}

// --- Categoría de prenda ----------------------------------------------------
export async function createCategoriaPrenda(data: {
  name: string;
  esUnicaPorDefecto?: boolean;
  codePrefix?: string;
}): Promise<ActionResult<CategoriaPrendaOption>> {
  return crear(
    delegateOf<CategoriaPrendaOption>('categoriaPrenda'),
    CATEGORIA,
    createCategoriaPrendaSchema,
    data
  );
}

export async function renameCategoriaPrenda(data: {
  id: number;
  name: string;
}): Promise<ActionResult<TaxonomyOption>> {
  return renombrar(
    delegateOf<TaxonomyOption>('categoriaPrenda'),
    CATEGORIA,
    data
  );
}

export async function setCategoriaPrendaActive(data: {
  id: number;
  active: boolean;
}): Promise<ActionResult<{ id: number; active: boolean }>> {
  return setActivo(
    delegateOf<{ id: number; active: boolean }>('categoriaPrenda'),
    CATEGORIA,
    data
  );
}

export async function getCategoriaPrendaOptions(): Promise<
  ActionResult<CategoriaPrendaOption[]>
> {
  return opciones(delegateOf<CategoriaPrendaOption>('categoriaPrenda'), CATEGORIA, {
    id: true,
    name: true,
    esUnicaPorDefecto: true,
    codePrefix: true,
  });
}

// --- Estilo -----------------------------------------------------------------
export async function createEstiloPrenda(data: {
  name: string;
}): Promise<ActionResult<TaxonomyOption>> {
  return crear(delegateOf<TaxonomyOption>('estiloPrenda'), ESTILO, createTaxonomySchema, data);
}

export async function renameEstiloPrenda(data: {
  id: number;
  name: string;
}): Promise<ActionResult<TaxonomyOption>> {
  return renombrar(delegateOf<TaxonomyOption>('estiloPrenda'), ESTILO, data);
}

export async function setEstiloPrendaActive(data: {
  id: number;
  active: boolean;
}): Promise<ActionResult<{ id: number; active: boolean }>> {
  return setActivo(
    delegateOf<{ id: number; active: boolean }>('estiloPrenda'),
    ESTILO,
    data
  );
}

export async function getEstiloPrendaOptions(): Promise<
  ActionResult<TaxonomyOption[]>
> {
  return opciones(delegateOf<TaxonomyOption>('estiloPrenda'), ESTILO, {
    id: true,
    name: true,
  });
}

// --- Condición --------------------------------------------------------------
export async function createCondicionPrenda(data: {
  name: string;
}): Promise<ActionResult<TaxonomyOption>> {
  return crear(
    delegateOf<TaxonomyOption>('condicionPrenda'),
    CONDICION,
    createTaxonomySchema,
    data
  );
}

export async function renameCondicionPrenda(data: {
  id: number;
  name: string;
}): Promise<ActionResult<TaxonomyOption>> {
  return renombrar(delegateOf<TaxonomyOption>('condicionPrenda'), CONDICION, data);
}

export async function setCondicionPrendaActive(data: {
  id: number;
  active: boolean;
}): Promise<ActionResult<{ id: number; active: boolean }>> {
  return setActivo(
    delegateOf<{ id: number; active: boolean }>('condicionPrenda'),
    CONDICION,
    data
  );
}

export async function getCondicionPrendaOptions(): Promise<
  ActionResult<TaxonomyOption[]>
> {
  return opciones(delegateOf<TaxonomyOption>('condicionPrenda'), CONDICION, {
    id: true,
    name: true,
  });
}

// --- Tipo de medida ---------------------------------------------------------
export async function createMedidaTipo(data: {
  name: string;
}): Promise<ActionResult<TaxonomyOption>> {
  return crear(delegateOf<TaxonomyOption>('medidaTipo'), MEDIDA, createTaxonomySchema, data);
}

export async function renameMedidaTipo(data: {
  id: number;
  name: string;
}): Promise<ActionResult<TaxonomyOption>> {
  return renombrar(delegateOf<TaxonomyOption>('medidaTipo'), MEDIDA, data);
}

export async function setMedidaTipoActive(data: {
  id: number;
  active: boolean;
}): Promise<ActionResult<{ id: number; active: boolean }>> {
  return setActivo(
    delegateOf<{ id: number; active: boolean }>('medidaTipo'),
    MEDIDA,
    data
  );
}

export async function getMedidaTipoOptions(): Promise<
  ActionResult<TaxonomyOption[]>
> {
  return opciones(delegateOf<TaxonomyOption>('medidaTipo'), MEDIDA, {
    id: true,
    name: true,
  });
}

// --- Canal de venta ---------------------------------------------------------
export async function createCanalVenta(data: {
  name: string;
}): Promise<ActionResult<TaxonomyOption>> {
  return crear(delegateOf<TaxonomyOption>('canalVenta'), CANAL, createTaxonomySchema, data);
}

export async function renameCanalVenta(data: {
  id: number;
  name: string;
}): Promise<ActionResult<TaxonomyOption>> {
  return renombrar(delegateOf<TaxonomyOption>('canalVenta'), CANAL, data);
}

export async function setCanalVentaActive(data: {
  id: number;
  active: boolean;
}): Promise<ActionResult<{ id: number; active: boolean }>> {
  return setActivo(
    delegateOf<{ id: number; active: boolean }>('canalVenta'),
    CANAL,
    data
  );
}

export async function getCanalVentaOptions(): Promise<
  ActionResult<TaxonomyOption[]>
> {
  return opciones(delegateOf<TaxonomyOption>('canalVenta'), CANAL, {
    id: true,
    name: true,
  });
}
