Prompt for AI Agent
Project Title: Local-First Veterinary Practice Management System (React + Node + SQLite + Docker)

Role: Act as a Senior Full-Stack Engineer and UX Architect.

Objective: Build a complete, performant, and "local-first" web application to replace a complex Google Sheets workflow for a veterinary clinic. The app must run entirely offline on a single PC using Docker. It should replace a spreadsheet that manages Products, Prices, Order Lines (Invoices), and Client Data, but with a significantly better user experience.

Tech Stack Constraints:

Infrastructure: Single docker-compose.yml file. No external internet dependencies required at runtime.

Database: SQLite (via better-sqlite3 or Prisma with SQLite). It is the "best db" for this case because it requires zero configuration, is a single file (easy to backup), and is extremely fast for local, single-user workloads.

Backend: Node.js (Fastify or Express).

Frontend: React (Vite) + Tailwind CSS + Shadcn UI (or Radix UI) for a high-quality, accessible design.

Language: TypeScript (Strict mode).

Core Features & Logic
1. The "Smart" Invoice Editor (The Sheet Replacement)
Interface: A clean, keyboard-navigable form.

Dynamic Table:

Columns: Product (Searchable Dropdown), Quantity, Unit Price (Auto-filled but editable), Line Total (Auto-calc).

Logic: When I select a product, the Unit Price is fetched immediately. If I change the Quantity, the Total updates instantly.

Smart Product Search: A "Combo Box" input that filters products by name as I type.

Free-Text Entry: If I type a service that doesn't exist (e.g., "Emergency Call"), allow me to add it as a "Custom Item" for this invoice only without breaking the flow.

2. "Auto-Learning" CRM (Client & Pet Management)
The Problem: In spreadsheets, I have to re-type names or maintain a separate list.

The Solution:

Unified Input: When creating an invoice, I type the Client Name and Pet Name.

Auto-Complete: If I type "Joh...", suggest "John Doe".

Auto-Save: If I type a new name ("Jane Doe") and finalize the invoice, the system must automatically create a new Client record for Jane Doe in the background. Next time, she appears in the dropdown.

Pet Association: Link pets to owners. If I select "John Doe", filter the Pet dropdown to only show his pets (e.g., "Rex", "Fluffy").

3. Product & Inventory Database
CRUD View: A Data Table to manage products and base prices (in RON).

Stock Management (Bonus): A simple StockQuantity integer. Deduct from stock when an invoice is finalized. Warn if stock < 0.

4. Invoicing & PDF Export
Incremental IDs: Auto-generate IDs like INV-2025-001, INV-2025-002.

PDF Generation: Use react-pdf or jspdf.

Layout: Professional header with Logo (uploadable/static), Clinic Details, Client Details, and the Itemized Table.

Styling: Remove gridlines/UI elements. Look like a paper document.

5. Dashboard & Analytics
Home Screen:

KPI Cards: "Total Revenue Today", "Invoices Created", "Top Selling Service".

Recent Activity: A list of the last 10 invoices with status badges (Draft/Saved).

Technical Implementation Requirements
Database Schema (SQL):

Clients (id, name, contact_info)

Pets (id, name, species, client_id)

Products (id, name, price, stock)

Invoices (id, friendly_id, client_id, date, total_amount)

InvoiceItems (id, invoice_id, product_name_snapshot, quantity, price_snapshot) -> Note: Snapshot the name/price so historical invoices don't change if I change the product price later.

Docker Setup:

Create a multi-stage Dockerfile.

Stage 1: Build Frontend (Vite build).

Stage 2: Setup Backend.

Stage 3: Serve Backend + Static Frontend files using the Node server.

Volume: Mount a local volume ./data:/app/data so the SQLite database file persists across container restarts.

Visual Polish:

Use Zebra Striping (alternating colors) for all data tables (Even: White, Odd: Light Gray).

Use a consistent color theme (e.g., Slate/Blue).

Output Deliverables
Please provide the complete code structure including:

Project Tree structure.

docker-compose.yml & Dockerfile.

schema.sql (SQLite initialization).

Backend Logic: server.js (or index.ts) handling the API routes.

Frontend Logic: The main InvoiceForm.tsx component handling the complex state.