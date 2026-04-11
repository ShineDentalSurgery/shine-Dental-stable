const logger = require("../utils/logger");

async function initializeDatabase() {
    const db = require("../config/db");
    return db();
}

// Create or update treatment note
async function createTreatmentNote(patientId, patientName, patientPhone, patientAddress, gender, age, treatmentDate, treatmentNotes) {
    const connection = await initializeDatabase();
    try {
        // Check if treatment note exists for this date
        const [existing] = await connection.query(
            `SELECT id FROM treatment_notes 
             WHERE patient_id = ? AND DATE(treatment_date) = DATE(?)`,
            [patientId, treatmentDate]
        );

        if (existing && existing.length > 0) {
            // Update existing record
            await connection.query(
                `UPDATE treatment_notes 
                 SET treatment_notes = ?, 
                     patient_name = ?,
                     patient_phone = ?,
                     patient_address = ?,
                     gender = ?,
                     age = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE patient_id = ? AND DATE(treatment_date) = DATE(?)`,
                [treatmentNotes, patientName, patientPhone, patientAddress, gender, age, patientId, treatmentDate]
            );
            logger.info(`Updated treatment note for patient ${patientId}`);
            return existing[0].id;
        } else {
            // Create new record
            const [result] = await connection.query(
                `INSERT INTO treatment_notes 
                 (patient_id, patient_name, patient_phone, patient_address, gender, age, treatment_date, treatment_notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [patientId, patientName, patientPhone, patientAddress, gender, age, treatmentDate, treatmentNotes]
            );
            logger.info(`Created treatment note for patient ${patientId}`);
            return result.insertId;
        }
    } catch (error) {
        logger.error(`Error creating treatment note: ${error.message}`, error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Get treatment notes for a patient
async function getTreatmentNotesByPatient(patientId) {
    const connection = await initializeDatabase();
    try {
        const [result] = await connection.query(
            `SELECT * FROM treatment_notes 
             WHERE patient_id = ? 
             ORDER BY treatment_date DESC`,
            [patientId]
        );
        return result;
    } catch (error) {
        logger.error(`Error fetching treatment notes: ${error.message}`, error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Get single treatment note
async function getTreatmentNote(id) {
    const connection = await initializeDatabase();
    try {
        const [result] = await connection.query(
            `SELECT * FROM treatment_notes WHERE id = ?`,
            [id]
        );
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        logger.error(`Error fetching treatment note: ${error.message}`, error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Get all treatment notes (for dashboard)
async function getAllTreatmentNotes() {
    const connection = await initializeDatabase();
    try {
        const [result] = await connection.query(
            `SELECT * FROM treatment_notes ORDER BY treatment_date DESC`
        );
        return result;
    } catch (error) {
        logger.error(`Error fetching all treatment notes: ${error.message}`, error);
        throw error;
    } finally {
        await connection.end();
    }
}

// Delete treatment note
async function deleteTreatmentNote(id) {
    const connection = await initializeDatabase();
    try {
        const [result] = await connection.query(
            `DELETE FROM treatment_notes WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    } catch (error) {
        logger.error(`Error deleting treatment note: ${error.message}`, error);
        throw error;
    } finally {
        await connection.end();
    }
}

module.exports = {
    createTreatmentNote,
    getTreatmentNotesByPatient,
    getTreatmentNote,
    getAllTreatmentNotes,
    deleteTreatmentNote
};
