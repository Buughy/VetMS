
import { openDb } from './db';

const rawData = `KODI	495	"1 x Microchip+HB+RECS actions - 100 RON
1 x Nobivac DHPPi+RL - 130 RON
1 x Bravecto 4.5-10 kg - 160 RON
0.5 x Dehinel dog - 5 RON
1 x Passport - 100 RON"
CLYDE	495	"1 x Microchip+HB+RECS actions - 100 RON
1 x Nobivac DHPPi+RL - 130 RON
1 x Bravecto 4.5-10 kg - 160 RON
0.5 x Dehinel dog - 5 RON
1 x Passport - 100 RON"
BONNY	495	"1 x Microchip+HB+RECS actions - 100 RON
1 x Nobivac DHPPi+RL - 130 RON
1 x Bravecto 4.5-10 kg - 160 RON
0.5 x Dehinel dog - 5 RON
1 x Passport - 100 RON"
AMY	495	"1 x Microchip+HB+RECS actions - 100 RON
1 x Nobivac DHPPi+RL - 130 RON
1 x Bravecto 4.5-10 kg - 160 RON
0.5 x Dehinel dog - 5 RON
1 x Passport - 100 RON"
JACK	495	"1 x Microchip+HB+RECS actions - 100 RON
1 x Nobivac DHPPi+RL - 130 RON
1 x Bravecto 4.5-10 kg - 160 RON
0.5 x Dehinel dog - 5 RON
1 x Passport - 100 RON"
FLOCKE	495	"1 x Microchip+HB+RECS actions - 100 RON
1 x Nobivac DHPPi+RL - 130 RON
1 x Bravecto 4.5-10 kg - 160 RON
0.5 x Dehinel dog - 5 RON
1 x Passport - 100 RON"
FRANKY	495	"1 x Microchip+HB+RECS actions - 100 RON
1 x Nobivac DHPPi+RL - 130 RON
1 x Bravecto 4.5-10 kg - 160 RON
0.5 x Dehinel dog - 5 RON
1 x Passport - 100 RON"`;

const INVOICE_FRIENDLY_ID = 'MBV-0001';

async function main() {
    const db = openDb();

    // 1. Find Invoice
    const invoice = db.prepare('SELECT id, client_id, total_amount FROM invoices WHERE friendly_id = ?').get(INVOICE_FRIENDLY_ID) as { id: number; client_id: number; total_amount: number } | undefined;

    if (!invoice) {
        console.error(`Invoice ${INVOICE_FRIENDLY_ID} not found!`);
        process.exit(1);
    }

    console.log(`Found invoice ${INVOICE_FRIENDLY_ID} (ID: ${invoice.id}) for Client ID ${invoice.client_id}`);

    // 2. Parse Data
    const lines = rawData.split('\n');
    const petBlocks: { name: string; items: string[] }[] = [];

    let currentPet: { name: string; items: string[] } | null = null;
    let parsingQuote = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        // Check if new pet line: Starts with Uppercase Name + Number
        // Regex: ^([A-Z]+)\s+([\d\.]+)\s+(.*)$
        const match = line.match(/^([A-Z]+)\s+([\d\.]+)\s+(.*)$/);

        if (match && !parsingQuote) {
            const name = match[1];
            let content = match[3];

            // New Pet
            currentPet = { name, items: [] };
            petBlocks.push(currentPet);

            // Check if content starts with quote
            if (content.startsWith('"')) {
                content = content.slice(1);
                parsingQuote = true;
            }

            // Check if content ends with quote
            if (parsingQuote && content.endsWith('"')) {
                content = content.slice(0, -1);
                parsingQuote = false;
            }

            if (!content.startsWith('"') && !parsingQuote) {
                currentPet.items.push(content);
            } else {
                if (content) currentPet.items.push(content);
            }
        } else {
            // Continuation
            if (parsingQuote && line.endsWith('"')) {
                line = line.slice(0, -1);
                parsingQuote = false;
            }
            if (currentPet && line) {
                currentPet.items.push(line);
            }
        }
    }

    // 3. Insert Data
    let grandTotal = invoice.total_amount;

    for (const p of petBlocks) {
        // Ensure Pet
        let pet = db.prepare('SELECT id FROM pets WHERE name = ? AND client_id = ?').get(p.name, invoice.client_id) as { id: number } | undefined;
        if (!pet) {
            // Create new pet, species EMPTY as requested
            const info = db.prepare('INSERT INTO pets (name, client_id, species) VALUES (?, ?, NULL)').run(p.name, invoice.client_id);
            pet = { id: Number(info.lastInsertRowid) };
            console.log(`Created pet ${p.name}`);
        } else {
            console.log(`Found existing pet ${p.name}`);
        }

        for (const itemStr of p.items) {
            // Parse: Quantity x Name - Price RON
            const m = itemStr.match(/^([\d\.]+)\s*x\s*(.+?)\s*-\s*([\d\.]+)\s*RON/);
            if (m) {
                const qty = parseFloat(m[1]);
                const name = m[2];
                const lineTotal = parseFloat(m[3]);
                const priceSnapshot = lineTotal / qty;

                grandTotal += lineTotal;

                db.prepare(`
           INSERT INTO invoice_items (invoice_id, pet_id, product_name_snapshot, quantity, price_snapshot)
           VALUES (?, ?, ?, ?, ?)
         `).run(invoice.id, pet.id, name.trim(), qty, priceSnapshot);
            } else {
                console.warn(`Failed to parse item: ${itemStr}`);
            }
        }
    }

    // Update Invoice Total
    db.prepare('UPDATE invoices SET total_amount = ? WHERE id = ?').run(grandTotal, invoice.id);
    console.log(`Updated invoice total to ${grandTotal}`);
    console.log('Done!');
}

main();
