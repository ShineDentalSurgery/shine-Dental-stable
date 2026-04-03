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
        const [result] = await db.query(
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
             WHERE patient_name = ? AND patient_id IS NOT NULL 
             GROUP BY patient_id, patient_phone
             ORDER BY MAX(created_at) DESC`,
            [patient_name]
        );
        return result.length > 0 ? result : null;
    } catch (error) {
        logger.error(`Error checking patient by name: ${error.message}`, error);
        return null;
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
        
        // If a specific patient_id was provided, use it
        if (options.usePatientId) {
            patientId = options.usePatientId;
            logger.info(`Using provided patient ID: ${patientId}`);
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
                logger.info(`Existing patient found by phone - reusing ID: ${patientId}`);
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

async function getReceipts() {
    const db = await initializeDatabase();
    try {
        const [result] = await db.query(
            `SELECT * FROM receipts ORDER BY id DESC`
        );
        return result;
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

module.exports = { createReceipt, getReceiptDetails, getReceipts, deleteReceipt, updateReceipt, getReceiptsByPatient, getPatientDetails, generatePatientId, getExistingPatientByName };
