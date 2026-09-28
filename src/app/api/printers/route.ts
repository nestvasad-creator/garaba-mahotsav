import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DetectedPrinter {
  name: string;
  isDefault: boolean;
  isCardPrinter: boolean;
  driverName?: string;
  portName?: string;
}

export async function GET() {
  try {
    // Query Windows printers using PowerShell
    const psCmd = `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default, DriverName, PortName | ConvertTo-Json -Compress"`;
    const { stdout } = await execAsync(psCmd, { timeout: 10000 });

    if (!stdout || !stdout.trim()) {
      return NextResponse.json({ printers: [] });
    }

    let raw = JSON.parse(stdout.trim());
    if (!Array.isArray(raw)) {
      raw = [raw];
    }

    const cardPrinterRegex = /evolis|zebra|fargo|magicard|zenius|primacy|badgy|elypso|zc\d+|dtc|smart|idp/i;

    const printers: DetectedPrinter[] = raw.map((p: any) => ({
      name: p.Name,
      isDefault: Boolean(p.Default),
      isCardPrinter: cardPrinterRegex.test(p.Name) || cardPrinterRegex.test(p.DriverName || ''),
      driverName: p.DriverName,
      portName: p.PortName,
    }));

    // Sort: Card printers first, then default printer, then alphabetical
    printers.sort((a, b) => {
      if (a.isCardPrinter && !b.isCardPrinter) return -1;
      if (!a.isCardPrinter && b.isCardPrinter) return 1;
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ printers });
  } catch (err: any) {
    console.error('Failed to enumerate Windows printers:', err);
    return NextResponse.json(
      {
        printers: [
          { name: 'Evolis Primacy 2', isDefault: true, isCardPrinter: true },
          { name: 'Zebra ZC300 USB Card Printer', isDefault: false, isCardPrinter: true },
        ],
        error: err.message,
      },
      { status: 200 }
    );
  }
}
