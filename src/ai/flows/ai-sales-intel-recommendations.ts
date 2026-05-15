'use server';
/**
 * @fileOverview A Genkit flow for generating AI-powered sales intelligence.
 *
 * - getAISalesIntel - A function that analyzes sales data to provide restocking recommendations and weekly sales forecasts.
 * - AISalesIntelInput - The input type for the getAISalesIntel function.
 * - AISalesIntelOutput - The return type for the getAISalesIntel function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Represents the input structure for the AI sales intelligence flow.
 */
const AISalesIntelInputSchema = z.object({
  salesData: z.array(
    z.object({
      saleId: z.string().describe('Unique identifier for the sale.'),
      date: z.string().datetime().describe('ISO date string of when the sale occurred.'),
      items: z.array(
        z.object({
          productId: z.string().describe('Unique identifier for the product.'),
          name: z.string().describe('Name of the product sold.'),
          qty: z.number().int().min(1).describe('Quantity of the product sold.'),
          price: z.number().min(0).describe('Price per unit of the product in BS.'),
        })
      ).describe('List of products and their quantities in the sale.'),
    })
  ).describe('Array of past sales transactions.'),
  exchangeRateBSUSD: z.number().min(0.01).describe('Current exchange rate from BS to USD.'),
});
export type AISalesIntelInput = z.infer<typeof AISalesIntelInputSchema>;

/**
 * Represents the output structure for the AI sales intelligence flow.
 */
const AISalesIntelOutputSchema = z.object({
  restockingRecommendations: z.array(
    z.object({
      productId: z.string().describe('Unique identifier of the product to restock.'),
      productName: z.string().describe('Name of the product.'),
      quantityToOrder: z.number().int().min(0).describe('Recommended quantity to order.'),
      reason: z.string().describe('Reason for restocking recommendation (e.g., "high demand", "seasonal popularity").'),
    })
  ).describe('List of products recommended for restocking with quantities and reasons.'),
  weeklySalesForecast: z.object({
    totalRevenueBS: z.number().min(0).describe('Forecasted total revenue in BS for the upcoming week.'),
    totalRevenueUSD: z.number().min(0).describe('Forecasted total revenue in USD for the upcoming week.'),
    forecastDetails: z.string().describe('Detailed explanation of the sales forecast and methodology.'),
  }).describe('Weekly sales forecast details.'),
});
export type AISalesIntelOutput = z.infer<typeof AISalesIntelOutputSchema>;

const aiSalesIntelPrompt = ai.definePrompt({
  name: 'aiSalesIntelPrompt',
  input: {schema: AISalesIntelInputSchema},
  output: {schema: AISalesIntelOutputSchema},
  prompt: `You are an AI sales intelligence tool for a liquor store. Your task is to analyze the provided historical sales data to generate restocking recommendations and a weekly sales forecast.\n\nAnalyze the sales trends from the 'salesData' array, identifying popular products that might need to be restocked. For each recommended product, provide a recommended quantity to order and a concise reason.\nAlso, generate a sales forecast for the upcoming week, providing estimated total revenue in BS and USD, and a textual explanation of your forecast.\n\nHere is the historical sales data:\n{{{JSON.stringify salesData}}}\n\nCurrent exchange rate: 1 USD = {{exchangeRateBSUSD}} BS.`,
});

const aiSalesIntelFlow = ai.defineFlow(
  {
    name: 'aiSalesIntelFlow',
    inputSchema: AISalesIntelInputSchema,
    outputSchema: AISalesIntelOutputSchema,
  },
  async (input) => {
    const {output} = await aiSalesIntelPrompt(input);

    if (!output) {
      throw new Error('Failed to generate sales intelligence.');
    }
    return output;
  }
);

/**
 * Analyzes past sales data to provide restocking recommendations and a weekly sales forecast.
 * @param input - An object containing sales data and the current exchange rate.
 * @returns An object containing restocking recommendations and a weekly sales forecast.
 */
export async function getAISalesIntel(input: AISalesIntelInput): Promise<AISalesIntelOutput> {
  return aiSalesIntelFlow(input);
}
