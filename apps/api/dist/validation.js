import { z } from 'zod';
export const createOrUpdateProductSchema = z.object({
    name: z.string().min(1),
    price: z.number().finite().nonnegative(),
});
export const invoiceItemSchema = z.object({
    productId: z.number().int().positive().optional(),
    customName: z.string().min(1).optional(),
    quantity: z.number().finite().positive(),
    unitPrice: z.number().finite().nonnegative(),
});
export const invoicePetSchema = z.object({
    petName: z.string().min(1),
    petSpecies: z.string().optional(),
    items: z.array(invoiceItemSchema).min(1),
});
export const createInvoiceSchema = z.object({
    clientName: z.string().min(1),
    contactInfo: z.string().optional(),
    date: z.string().min(1),
    status: z.enum(['Draft', 'Paid']).default('Draft'),
    pets: z.array(invoicePetSchema).min(1),
});
export const createOrUpdateClientSchema = z.object({
    name: z.string().min(1),
    contactInfo: z.string().optional(),
});
