-- RUN 1 (alone): a new enum value can't be used in the same transaction
ALTER TYPE public.document_phase ADD VALUE IF NOT EXISTS 'Liquidation';

-- RUN 2:
-- a) Make the transfer docs apply to Fund Transfer too
UPDATE public.document_types
   SET applies_to = 'Both'
 WHERE name IN (
   'LOI for Transfer','Feature Article','F1 - Endorsement of PSTO',
   'F2 - Evaluation and Endorsement of RPMO','Approval of Request of Ownership',
   'Property Transfer Report','List of Equipment Purchased (LEP)',
   'Deed of Donation and Certificate of Acceptance (DOD&CA)');

-- b) Move the liquidation packet into its own phase (documents follow via document_type_id)
UPDATE public.document_types
   SET phase = 'Liquidation'
 WHERE (phase::text, name) IN (
   ('Annual','Form 8 - List of Personnel Involved'),
   ('Annual','Form 9 - List of Equipment Purchased'),
   ('Annual','Form 12 - Fund Utilization Report'),
   ('Annual','Form 13 - Schedule of Accounts Payable'),
   ('Transfer','Form 6 - Line-Item Budget'),
   ('Transfer','Form 15 - Project Monitoring and Field Evaluation Report'),
   ('Transfer','Form 17 - Executive Summary for the Terminal Accomplishment Report'),
   ('Transfer','Form 18 - Terminal Financial Report'),
   ('Transfer','Reports of Checks Issued (RCI)'),
   ('Transfer','Report of Cash Disbursements (RCD)'),
   ('Transfer','JEV (Journal Entry Voucher)'),
   ('Transfer','PAR (Property Acknowledgement Receipt)'),
   ('Transfer','List of Equipment Purchased (LEP)'),
   ('Transfer','ICS (Inventory Custodian Slip)'),
   ('Transfer','Insurance of Equipment'),
   ('Transfer','Warranty of Equipment'),
   ('Transfer','Refund Check (Unexpended Balance)'));
