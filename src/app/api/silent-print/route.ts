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
 *     printerName: string;      // Destination printer identifier or name
 *   }
 *
 * Uses Windows .NET System.Drawing.Printing.PrintDocument executed completely headless
 * via PowerShell. This sends raw page draw commands directly into the Windows Print Spooler
 * for the Zebra ZC300 or specified printer WITHOUT launching MS Paint or any GUI window,
 * and WITHOUT opening the browser print dialog.
 *
 * Automatically enforces Simplex (single-sided) printing to prevent duplex card flip.
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

    const tempDir = os.tmpdir();
    const sessionId = `cr80-batch-${Date.now()}`;
    const tempFiles: string[] = [];

    // 1. Write each card base64 image to temporary PNG files
    for (let i = 0; i < dataUrls.length; i++) {
      const dataUrl = dataUrls[i];
      const tempFile = path.join(tempDir, `${sessionId}-card-${i + 1}.png`);
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(tempFile, buffer);
      tempFiles.push(tempFile);
    }

    // 2. Generate a clean PowerShell script that prints headless via .NET PrintDocument
    const scriptPath = path.join(tempDir, `${sessionId}-print.ps1`);
    const escapedPrinterName = (printerName || 'Zebra ZC300 USB Card Printer').replace(/'/g, "''");
    const escapedFilePaths = tempFiles.map((f) => `'${f.replace(/'/g, "''")}'`).join(',\n    ');

    const psScriptContent = `
Add-Type -AssemblyName System.Drawing

$requested = '${escapedPrinterName}'
$installed = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters

# Match target printer: exact, case-insensitive, or substring (e.g. ZC300 or Zebra)
$targetPrinter = $null
foreach ($p in $installed) {
    if ($p -eq $requested) {
        $targetPrinter = $p
        break
    }
}
if (-not $targetPrinter) {
    foreach ($p in $installed) {
        if ($p -like "*$requested*" -or $requested -like "*$p*") {
            $targetPrinter = $p
            break
        }
    }
}
if (-not $targetPrinter -and ($requested -like "*ZEBRA*" -or $requested -like "*ZC300*")) {
    foreach ($p in $installed) {
        if ($p -like "*ZC300*" -or $p -like "*Zebra*") {
            $targetPrinter = $p
            break
        }
    }
}
if (-not $targetPrinter) {
    foreach ($p in $installed) {
        if ($p -like "*Zebra*") {
            $targetPrinter = $p
            break
        }
    }
}
if (-not $targetPrinter) {
    $targetPrinter = [System.Drawing.Printing.PrinterSettings]::new().PrinterName
}

Write-Output "TARGET_PRINTER:$targetPrinter"

$cardFiles = @(
    ${escapedFilePaths}
)

$printedCount = 0

foreach ($filePath in $cardFiles) {
    if (-not (Test-Path $filePath)) {
        Write-Warning "File not found: $filePath"
        continue
    }

    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $targetPrinter

    if (-not $doc.PrinterSettings.IsValid) {
        throw "Printer '$targetPrinter' is not valid or offline."
    }

    # CRITICAL: Force single-sided (Simplex) printing to prevent 2-sided flip
    if ($doc.PrinterSettings.CanDuplex) {
        $doc.PrinterSettings.Duplex = [System.Drawing.Printing.Duplex]::Simplex
    }

    $img = [System.Drawing.Image]::FromFile($filePath)

    $doc.add_PrintPage({
        param($sender, $ev)
        # Fit CR80 card image directly to printable page bounds
        $ev.Graphics.DrawImage($img, $ev.PageBounds)
        $ev.HasMorePages = $false
    })

    $doc.Print()
    $img.Dispose()
    $doc.Dispose()

    $printedCount++

    # Short delay to allow card printer feeder to spool sequential jobs
    Start-Sleep -Milliseconds 450
}

Write-Output "PRINTED_COUNT:$printedCount"
`;

    await fs.writeFile(scriptPath, psScriptContent, 'utf8');

    // 3. Execute the PowerShell headless print job
    let stdout = '';
    try {
      const execResult = await execAsync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`,
        { timeout: 120000 }
      );
      stdout = execResult.stdout || '';
    } finally {
      // 4. Clean up temp files asynchronously after a safety delay
      setTimeout(async () => {
        try {
          await fs.unlink(scriptPath);
        } catch (_) {}
        for (const f of tempFiles) {
          try {
            await fs.unlink(f);
          } catch (_) {}
        }
      }, 15000);
    }

    const matchedPrinterLine = stdout.split('\n').find((l) => l.startsWith('TARGET_PRINTER:'));
    const resolvedPrinter = matchedPrinterLine ? matchedPrinterLine.replace('TARGET_PRINTER:', '').trim() : printerName;

    return NextResponse.json({
      success: true,
      successCount: tempFiles.length,
      failCount: 0,
      printerName: resolvedPrinter,
      message: `${tempFiles.length} card(s) sent directly to ${resolvedPrinter} without dialog.`,
    });
  } catch (err: any) {
    console.error('Silent print route error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error in silent print route.' },
      { status: 500 }
    );
  }
}
