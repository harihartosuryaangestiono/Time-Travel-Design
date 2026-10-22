import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

interface ScannedLineItem {
  id: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  subtotal: number;
}

// In-memory rate limiting: Map<userId, { count: number, resetAt: number }>
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_BASE64_SIZE_BYTES = 8 * 1024 * 1024; // ~6MB binary data in base64

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Authentication is required to scan receipts." },
        { status: 401 }
      );
    }

    // 2. In-memory Rate Limiting per user
    const now = Date.now();
    const userLimit = rateLimitMap.get(user.id);
    if (userLimit && now < userLimit.resetAt) {
      if (userLimit.count >= MAX_REQUESTS_PER_MINUTE) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please wait a minute before scanning more receipts." },
          { status: 429 }
        );
      }
      userLimit.count += 1;
    } else {
      rateLimitMap.set(user.id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }

    // Clean old entries periodically
    if (rateLimitMap.size > 1000) {
      rateLimitMap.forEach((val, key) => {
        if (now >= val.resetAt) {
          rateLimitMap.delete(key);
        }
      });
    }

    // 3. Parse and validate body
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg" } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "Image data (base64 string) is required" },
        { status: 400 }
      );
    }

    // Check payload size
    if (imageBase64.length > MAX_BASE64_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image payload exceeds maximum limit of 6MB. Please compress the image." },
        { status: 413 }
      );
    }

    const apiKey =
      req.headers.get("x-gemini-api-key") ||
      process.env.GEMINI_API_KEY ||
      process.env.OCR_API_KEY;

    if (!apiKey || apiKey === "your_ocr_api_key") {
      return NextResponse.json(
        {
          success: false,
          needsApiKey: true,
          error:
            "GEMINI_API_KEY belum dikonfigurasi. Untuk memindai struk/bon fisik apa saja secara dinamis, masukkan Google Gemini API Key Anda.",
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `You are an expert Indonesian receipt and invoice OCR analyst for an architecture & construction firm.
Carefully examine every handwritten or printed text line, table cell, quantity, and price in this image.
Extract the exact real data from this specific receipt:
1. merchant: The store or vendor name printed/written on the receipt.
2. receiptNumber: The receipt / invoice number if visible, otherwise create an appropriate reference based on the date.
3. date: The date on the receipt in YYYY-MM-DD format (convert from Indonesian format like 15/10/2026 or 15 Okt 2026).
4. description: A clear concise summary of what was purchased.
5. category: One of: "Project Material", "Subcontractor", "Site Logistics", "Equipment & Tools", "Hospitality".
6. paymentMethod: Payment method if noted ("CASH", "BANK_TRANSFER", "DEBIT"). Default to "CASH" unless bank transfer info is written.
7. items: Extract every single line item actually written on this receipt:
   - description: Item name as written on the receipt.
   - qty: Numeric quantity.
   - unit: Unit of measurement (e.g., pcs, bh, tb, zak, roll, m2, ltr, box).
   - unit_price: Price per unit in IDR as an integer.
   - subtotal: Total amount for this line item in IDR.
8. totalBilled: The actual grand total written or printed at the bottom of the receipt in IDR.
9. notes: Any bank accounts, phone numbers, or special notes written on the receipt.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING },
            receiptNumber: { type: Type.STRING, nullable: true },
            date: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            paymentMethod: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  qty: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  unit_price: { type: Type.NUMBER },
                  subtotal: { type: Type.NUMBER },
                },
                required: ["description", "qty", "unit", "unit_price", "subtotal"],
              },
            },
            totalBilled: { type: Type.NUMBER },
            notes: { type: Type.STRING, nullable: true },
          },
          required: [
            "merchant",
            "date",
            "description",
            "category",
            "paymentMethod",
            "items",
            "totalBilled",
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const mappedItems: ScannedLineItem[] = (parsed.items || []).map(
      (it: any, idx: number) => ({
        id: `item-${Date.now()}-${idx}`,
        description: it.description,
        qty: Number(it.qty) || 1,
        unit: it.unit || "pcs",
        unit_price: Number(it.unit_price) || 0,
        subtotal: Number(it.subtotal) || (Number(it.qty) || 1) * (Number(it.unit_price) || 0),
      })
    );

    return NextResponse.json({
      success: true,
      merchant: parsed.merchant,
      receiptNumber: parsed.receiptNumber || "",
      date: parsed.date || new Date().toISOString().split("T")[0],
      description: parsed.description,
      category: parsed.category || "Project Material",
      paymentMethod: parsed.paymentMethod || "CASH",
      items: mappedItems,
      totalBilled: parsed.totalBilled,
      notes: parsed.notes || "",
      source: "gemini-3.8-flash",
    });
  } catch (err: any) {
    console.error("OCR Scanner Route Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process receipt image" },
      { status: 500 }
    );
  }
}

