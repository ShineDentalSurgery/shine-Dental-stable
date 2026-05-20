const initializeDatabase = require("../config/db");
const logger = require("../utils/logger");

// Check if patient already exists by phone number
async function getExistingPatientId(db, patient_phone) {
    try {
        const [result] = await db.query(
            `SELECT DISTINCT patient_id FROM receipts 
             WHERE patient_phone = ? AND patient_id IS NOT NULL 
             LIMIT 1`,
            [patient_phone]
        );
        return result.length > 0 ? result[0].patient_id : null;
    } catch (error) {
        logger.error(`Error checking existing patient: ${error.message}`, error);
        return null;
    }
}

// Check if patient name already exists and return their details with additional info
// Returns multiple matches if same name exists more than once
async function getExistingPatientByName(db, patient_name) {
    try {
        const normalizedPatientName = patient_name.trim().toLowerCase();
        const [exactMatch] = await db.query(
            `SELECT 
                patient_id, 
                patient_name, 
                patient_phone, 
                ANY_VALUE(patient_address) as patient_address,
                ANY_VALUE(gender) as gender,
                ANY_VALUE(age) as age,
                COUNT(*) as receipt_count,
                MAX(created_at) as last_visit_date,
                GROUP_CONCAT(DISTINCT service SEPARATOR ', ') as services
             FROM receipts 
             WHERE LOWER(TRIM(patient_name)) = ?
             GROUP BY patient_id, patient_phone, patient_name
             ORDER BY MAX(created_at) DESC`,
            [normalizedPatientName]
        );

        if (exactMatch.length > 0) {
            return exactMatch;
        }

        logger.warn(`Exact patient name lookup failed for "${patient_name}"; trying fallback search.`);

        const [fuzzyMatch] = await db.query(
            `SELECT 
                patient_id, 
                patient_name, 
                patient_phone, 
                ANY_VALUE(patient_address) as patient_address,
                ANY_VALUE(gender) as gender,
                ANY_VALUE(age) as age,
                COUNT(*) as receipt_count,
                MAX(created_at) as last_visit_date,
                GROUP_CONCAT(DISTINCT service SEPARATOR ', ') as services
             FROM receipts 
             WHERE LOWER(TRIM(patient_name)) LIKE CONCAT('%', ?, '%')
             GROUP BY patient_id, patient_phone, patient_name
             ORDER BY MAX(created_at) DESC`,
            [normalizedPatientName]
        );

        return fuzzyMatch.length > 0 ? fuzzyMatch : null;
    } catch (error) {
        logger.error(`Error checking patient by name: ${error.message}`, error);
        return null;
    }
}

// Validate and reformat patient ID to standard format: sds-YY-MM-NNN
async function validateAndFormatPatientId(db, patientId, createdDate = null) {
    try {
        // Check if already in correct format: sds-YY-MM-NNN
        const correctFormat = /^sds-\d{2}-\d{2}-\d{3}$/;
        if (correctFormat.test(patientId)) {
            return patientId;
        }

        // If not in correct format, try to reformat
        logger.info(`Patient ID not in standard format: ${patientId}. Attempting to reformat.`);

        // Use provided date or current date
        const dateToUse = createdDate ? new Date(createdDate) : new Date();
        const year = String(dateToUse.getFullYear()).slice(-2);
        const month = String(dateToUse.getMonth() + 1).padStart(2, '0');

        // Try to extract sequence number from various formats
        let sequence = 0;
        
        // Format: sds-26-02-3 (missing zero-padding)
        const match1 = patientId.match(/sds-\d{2}-\d{2}-(\d+)$/);
        if (match1) {
            sequence = parseInt(match1[1]);
        }
        
        // Format: sds-2026-02-3 (4-digit year)
        const match2 = patientId.match(/sds-\d{4}-\d{2}-(\d+)$/);
        if (match2) {
            sequence = parseInt(match2[1]);
        }
        
        // Format: just a number
        if (!sequence && /^\d+$/.test(patientId)) {
            sequence = parseInt(patientId);
        }

        // If we found a sequence, use it; otherwise generate new one
        if (sequence > 0) {
            const formattedSequence = String(sequence).padStart(3, '0');
            const reformattedId = `sds-${year}-${month}-${formattedSequence}`;
            logger.info(`Reformatted patient ID from ${patientId} to ${reformattedId}`);
            return reformattedId;
        }

        // If we couldn't extract a sequence, generate a new one
        logger.warn(`Could not reformat patient ID: ${patientId}. Generating new ID.`);
        return await generatePatientId(db);

    } catch (error) {
        logger.error(`Error validating/formatting patient ID: ${error.message}`, error);
        return await generatePatientId(db);
    }
}

// Generate unique patient ID in format: sds-YY-MM-NNN
async function generatePatientId(db) {
    try {
        const now = new Date();
        const year = String(now.getFullYear()).slice(-2); // Get last 2 digits (26 for 2026)
        const month = String(now.getMonth() + 1).padStart(2, '0'); // MM format (01-12)

        // Find the highest sequence number for this year-month
        const [result] = await db.query(  
            `SELECT SUBSTRING_INDEX(patient_id, '-', -1) as sequence 
             FROM receipts 
             WHERE patient_id LIKE ? 
             ORDER BY patient_id DESC 
             LIMIT 1`,
            [`sds-${year}-${month}-%`]
        );
        
        let nextSequence = 1;
        if (result.length > 0) {
            const lastSequence = parseInt(result[0].sequence || 0);
            nextSequence = lastSequence + 1;
        }
        
        const sequence = String(nextSequence).padStart(3, '0');
        const patientId = `sds-${year}-${month}-${sequence}`;
        
        return patientId;
    } catch (error) {
        logger.error(`Error generating patient ID: ${error.message}`, error);
        throw error;
    }
}

async function createReceipt(patient_name, patient_phone, patient_address, patient_gender, patient_age, patient_next_visit, room_number, service, qty, amount, total, mode_of_payment, amount_paid, balance, options = {}) {
    const db = await initializeDatabase();
    try {
        let patientId;
        
        // If a specific patient_id was provided, validate and reformat it
        if (options.usePatientId) {
            patientId = await validateAndFormatPatientId(db, options.usePatientId);
            logger.info(`Using provided patient ID (validated): ${patientId}`);
        }
        // If forceNewId is true, skip phone check and always generate new ID
        else if (options.forceNewId) {
            patientId = await generatePatientId(db);
            logger.info(`User chose new patient ID: ${patientId}`);
        }
        // Otherwise, check if patient exists by phone number
        else {
            patientId = await getExistingPatientId(db, patient_phone);
            
            // If not found by phone, generate new unique patient ID
            if (!patientId) {
                patientId = await generatePatientId(db);
                logger.info(`New patient assigned ID: ${patientId}`);
            } else {
                // Validate and reformat existing patient ID if needed
                patientId = await validateAndFormatPatientId(db, patientId);
                logger.info(`Existing patient found by phone - using ID: ${patientId}`);
            }
        }
        
        const sql = `INSERT INTO receipts (patient_id, patient_name, patient_phone, patient_address, gender, age, next_visit, room_number, service, qty, amount, total, mode_of_payment, amount_paid, balance) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.query(sql, [
            patientId,
            patient_name, 
            patient_phone, 
            patient_address || null, 
            patient_gender || null, 
            patient_age || null, 
            patient_next_visit || null, 
            room_number || null, 
            service, 
            qty, 
            amount, 
            total, 
            mode_of_payment, 
            amount_paid, 
            balance
        ]);
        return result;
    } catch (error) {
        logger.error(`Error in createReceipt: ${error.message}`, error);
        return null;
    } finally {
        await db.end();
    }
}

async function getReceiptDetails(id) {
    const db = await initializeDatabase();
    try {
        const [result] = await db.query(
            `SELECT * FROM receipts WHERE id = ?`,
            [id]
        );
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        logger.error(`Error in getReceiptDetails: ${error.message}`, error);
        throw new Error("Failed to retrieve receipt details");
    } finally {
        await db.end();
    }
}

async function getReceipts(page, perPage, search) {
    const db = await initializeDatabase();
    try {
        const searchTerm = search && search.toString().trim().length > 0
            ? `%${search.toString().trim().toLowerCase()}%`
            : null;

        const whereClause = searchTerm
            ? `WHERE LOWER(patient_name) LIKE ? OR LOWER(patient_phone) LIKE ? OR LOWER(patient_id) LIKE ?`
            : '';
        const whereParams = searchTerm ? [searchTerm, searchTerm, searchTerm] : [];

        if (page === undefined && perPage === undefined) {
            const [result] = await db.query(
                `SELECT * FROM receipts ${whereClause} ORDER BY created_at DESC`,
                whereParams
            );
            return result;
        }

        const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
        const normalizedLimit = Number.isInteger(perPage) && perPage > 0 ? perPage : 100;
        const offset = (normalizedPage - 1) * normalizedLimit;

        const [result] = await db.query(
            `SELECT * FROM receipts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...whereParams, normalizedLimit, offset]
        );
        const [countRows] = await db.query(
            `SELECT COUNT(*) as total FROM receipts ${whereClause}`,
            whereParams
        );

        return {
            receipts: result,
            totalCount: countRows[0].total
        };
    } catch (error) {
        logger.error(`Error in getReceipts: ${error.message}`, error);
        throw error;
    } finally {
        await db.end();
    }
}

async function deleteReceipt(id) {
    const db = await initializeDatabase();
    try {
        const [result] = await db.query("DELETE FROM receipts WHERE id = ?", [id]);
        return result.affectedRows > 0;
    } catch (error) {
        logger.error(`Error in deleteReceipt: ${error.message}`, error);
        throw error;
    } finally {
        await db.end();
    }
}

async function updateReceipt(id, patient_name, patient_phone, patient_address, patient_gender, patient_age, patient_next_visit, room_number, service, qty, amount, total, mode_of_payment, amount_paid, balance) {
    const db = await initializeDatabase();
    try {
        const sql = `
            UPDATE receipts
            SET patient_name = ?, patient_phone = ?, patient_address = ?, gender = ?, age = ?, next_visit = ?, room_number = ?, service = ?, qty = ?, amount = ?, total = ?, mode_of_payment = ?, amount_paid = ?, balance = ?
            WHERE id = ?
        `;
        const [result] = await db.query(sql, [
            patient_name,
            patient_phone,
            patient_address || null,
            patient_gender || null,
            patient_age || null,
            patient_next_visit || null,
            room_number || null,
            service,
            qty,
            amount,
            total,
            mode_of_payment,
            amount_paid,
            balance,
            id
        ]);
        return result.affectedRows > 0;
    } catch (error) {
        logger.error(`Error in updateReceipt: ${error.message}`, error);
        throw error;
    } finally {
        await db.end();
    }
}

async function getReceiptsByPatient(patient_phone) {
    const db = await initializeDatabase();
    try {
        const [result] = await db.query(
            `SELECT * FROM receipts WHERE patient_phone = ? ORDER BY created_at DESC`,
            [patient_phone]
        );
        return result;
    } catch (error) {
        logger.error(`Error in getReceiptsByPatient: ${error.message}`, error);
        throw error;
    } finally {
        await db.end();
    }
}

async function getPatientDetails(patient_phone) {
    const db = await initializeDatabase();
    try {
        const [result] = await db.query(
            `SELECT DISTINCT patient_name, patient_phone, patient_address, gender, age FROM receipts WHERE patient_phone = ? LIMIT 1`,
            [patient_phone]
        );
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        logger.error(`Error in getPatientDetails: ${error.message}`, error);
        throw error;
    } finally {
        await db.end();
    }
}

module.exports = { createReceipt, getReceiptDetails, getReceipts, deleteReceipt, updateReceipt, getReceiptsByPatient, getPatientDetails, generatePatientId, getExistingPatientByName, validateAndFormatPatientId };
