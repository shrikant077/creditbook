import { z } from "zod";

export const storeNameSchema = z.string().trim().min(2).max(120);
export const customerNameSchema = z.string().trim().min(1).max(120);
export const phoneSchema = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Use international format, e.g. +919876543210.");
export const descriptionSchema = z.string().trim().min(1).max(500);
export const amountRupeesSchema = z.string().trim().regex(/^\d{1,9}(?:\.\d{1,2})?$/, "Enter a valid amount with up to two decimal places.");
export const claimCodeSchema = z.string().trim().regex(/^\d{8}$/, "Enter the 8-digit access code.");
