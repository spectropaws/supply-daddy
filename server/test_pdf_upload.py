import requests
import asyncio
from httpx import AsyncClient

async def test_flow():
    base_url = "http://localhost:8000"
    
    print("1. Creating dummy PDF files...")
    po_content = b"%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj\n4 0 obj <</Length 51>> stream\nBT /F1 24 Tf 100 700 Td (PURCHASE ORDER: PO-992211 - Semiconductors) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000213 00000 n\ntrailer <</Size 5 /Root 1 0 R>>\nstartxref\n314\n%%EOF"
    invoice_content = b"%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj\n4 0 obj <</Length 51>> stream\nBT /F1 24 Tf 100 700 Td (INVOICE: INV-12345 - $50,000 USD) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000213 00000 n\ntrailer <</Size 5 /Root 1 0 R>>\nstartxref\n304\n%%EOF"
    bol_content = b"%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj\n4 0 obj <</Length 51>> stream\nBT /F1 24 Tf 100 700 Td (BILL OF LADING: BOL-999 - 50 kg electronics) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000213 00000 n\ntrailer <</Size 5 /Root 1 0 R>>\nstartxref\n313\n%%EOF"
    
    with open("po.pdf", "wb") as f: f.write(po_content)
    with open("invoice.pdf", "wb") as f: f.write(invoice_content)
    with open("bol.pdf", "wb") as f: f.write(bol_content)
    
    print("2. Faking Authorization Header (We need a manufacturer token)...")
    import jwt
    token = jwt.encode({"user_id": "m1", "role": "manufacturer"}, "secret", algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    
    print("3. Creating Shipment with POST /shipments/ ...")
    async with AsyncClient() as client:
        with open("po.pdf", "rb") as po, open("invoice.pdf", "rb") as inv, open("bol.pdf", "rb") as bol:
            files = {
                "po_file": ("po.pdf", po, "application/pdf"),
                "invoice_file": ("invoice.pdf", inv, "application/pdf"),
                "bol_file": ("bol.pdf", bol, "application/pdf"),
            }
            data = {
                "origin": "SZX",
                "destination": "LAX",
                "receiver_id": "r1"
            }
            # Note: auth logic uses firebase inside middleware... Let's just bypass auth for the test if possible or register a test user.
            pass

asyncio.run(test_flow())
