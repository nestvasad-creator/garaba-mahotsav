import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * POST /api/silent-print
 *
 * Body (JSON):
 *   {
 *     dataUrls: string[];       // Array of base64 PNG data URLs, one per card
 *     printerName: string;      // Windows printer name, e.g. "ZEBRA-ZC300-USB01"
 *   }
 *
 * This route saves each PNG to a temp file and prints it silently using:
 *   PowerShell: Start-Process mspaint -ArgumentList "/pt","<file>","<printer>" -Wait -NoNewWindow
 *
 * This completely bypasses the browser print dialog — the card goes directly to the
 * Windows print spooler for the selected printer with no user interaction.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataUrls, printerName } = body as {
      dataUrls: string[];
      printerName: string;
    };

    if (!dataUrls || !Array.isArray(dataUrls) || dataUrls.length === 0) {
      return NextResponse.json({ success: false, error: 'No card images provided.' }, { status: 400 });
    }

    if (!printerName || typeof printerName !== 'string') {
      return NextResponse.json({ success: false, error: 'Printer name is required.' }, { status: 400 });
    }

    const tempDir = os.tmpdir();
    const sessionId = `cr80-${Date.now()}`;
    const tempFiles: string[] = [];
    const results: Array<{ index: number; success: boolean; error?: string }> = [];

    for (let i = 0; i < dataUrls.length; i++) {
      const dataUrl = dataUrls[i];
      const tempFile = path.join(tempDir, `${sessionId}-card-${i + 1}.png`);

      try {
        // Strip the "data:image/png;base64," prefix
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(tempFile, buffer);
        tempFiles.push(tempFile);

        // Use PowerShell to print silently via Windows print infrastructure
        // mspaint supports /pt flag: mspaint /pt <file> <printer>
        // escape printer name for PowerShell
        const escapedPrinter = printerName.replace(/'/g, "''");
        const escapedFile = tempFile.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const psCommand = `Start-Process -FilePath 'mspaint.exe' -ArgumentList '/pt','${escapedFile}','${escapedPrinter}' -Wait -NoNewWindow -PassThru | Out-Null`;

        await execAsync(`powershell -NoProfile -NonInteractive -Command "${psCommand.replace(/"/g, '\\"')}"`, {
          timeout: 30000,
        });

        results.push({ index: i, success: true });
      } catch (cardErr: any) {
        console.error(`Silent print error for card ${i + 1}:`, cardErr);
        results.push({ index: i, success: false, error: cardErr.message });
      }
    }

    // Cleanup temp files after a short delay to allow spooler to read them
    setTimeout(async () => {
      for (const f of tempFiles) {
        try {
          await fs.unlink(f);
        } catch (_) {
          // ignore cleanup errors
        }
      }
    }, 15000);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      successCount,
      failCount,
      results,
      message:
        failCount === 0
          ? `${successCount} card(s) sent to printer ${printerName} successfully.`
          : `${successCount} succeeded, ${failCount} failed. Check server logs.`,
    });
  } catch (err: any) {
    console.error('Silent print route error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error in silent print route.' },
      { status: 500 }
    );
  }
}
