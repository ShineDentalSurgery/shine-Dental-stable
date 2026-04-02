const initializeDatabase = require("../config/db");
const logger = require("../utils/logger");

async function getAllAppointments() {
    const db = await initializeDatabase();
    try {
        // Get unique patients with next visits that are not yet due (future dates only)
        const [result] = await db.query(`
            SELECT DISTINCT
                patient_phone,
                patient_name,
                patient_address,
                gender,
                age,
                next_visit,
                room_number,
                MAX(created_at) as last_visit,
                COUNT(id) as total_visits
            FROM receipts
            WHERE next_visit IS NOT NULL AND next_visit > CURDATE()
            GROUP BY patient_phone, patient_name, patient_address, gender, age, next_visit, room_number
            ORDER BY next_visit ASC
        `);
        return result;
    } catch (error) {
        logger.error(`Error in getAllAppointments: ${error.message}`, error);
        throw error;
    } finally {
        await db.end();
    }
}

async function getAppointmentsByNextVisit(startDate, endDate) {
    const db = await initializeDatabase();
    try {
        const [result] = await db.query(`
            SELECT DISTINCT
                patient_phone,
                patient_name,
                patient_address,
                gender,
                age,
                next_visit,
                room_number,
                MAX(created_at) as last_visit
            FROM receipts
            WHERE next_visit BETWEEN ? AND ?
            GROUP BY patient_phone, patient_name, patient_address, gender, age, next_visit, room_number
            ORDER BY next_visit ASC
        `, [startDate, endDate]);
        return result;
    } catch (error) {
        logger.error(`Error in getAppointmentsByNextVisit: ${error.message}`, error);
        throw error;
    } finally {
        await db.end();
    }
}

async function getPatientAppointmentHistory(patient_phone) {
    const db = await initializeDatabase();
    try {
        const [result] = await db.query(`
            SELECT 
                id as receipt_id,
                patient_name,
                patient_phone,
                patient_address,
                gender,
                age,
                next_visit,
                room_number,
                service,
                total,
                created_at as visit_date
            FROM receipts
            WHERE patient_phone = ?
            ORDER BY created_at DESC
        `, [patient_phone]);
        return result;
    } catch (error) {
        logger.error(`Error in getPatientAppointmentHistory: ${error.message}`, error);
        throw error;
    } finally {
        await db.end();
    }
}

async function getPatientsWithUpcomingVisits() {
    const db = await initializeDatabase();
    try {
        const [result] = await db.query(`
            SELECT DISTINCT
                patient_phone,
                patient_name,
                patient_address,
                gender,
                age,
                next_visit,
                room_number,
                MAX(created_at) as last_visit,
                DATEDIFF(next_visit, CURDATE()) as days_until_visit
            FROM receipts
            WHERE next_visit IS NOT NULL AND next_visit >= CURDATE() AND next_visit <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            GROUP BY patient_phone, patient_name, patient_address, gender, age, next_visit, room_number
            ORDER BY next_visit ASC
        `);
        return result;
    } catch (error) {
        logger.error(`Error in getPatientsWithUpcomingVisits: ${error.message}`, error);
        throw error;
    } finally {
        await db.end();
    }
}

module.exports = { 
    getAllAppointments, 
    getAppointmentsByNextVisit,
    getPatientAppointmentHistory,
    getPatientsWithUpcomingVisits
};
